import type { Browser } from "playwright";
import { repairLocatorsWithOllama } from "./aiLocatorRepair.js";
import { classifyErrorMessage } from "./failureDetector.js";
import { generateRuleBasedFallbacks } from "./fallbackLocatorGenerator.js";
import { lookupHealingMemory, saveHealingSuccess } from "./healingMemoryStore.js";
import { tryLocatorsUntilSuccess } from "./retryExecutor.js";
import type {
  FallbackLocator,
  FailureReport,
  LocatorHealingRequest,
  LocatorHealingResult,
} from "./types.js";
import { getSharedBrowser, resetPlaywrightBrowser } from "../playwright.js";
import { resolvePlaywrightLocale, type PlaywrightLocaleMode } from "../playwrightLocale.js";

const NAV_MS = 12_000;

function toPlaywrightSelector(f: FallbackLocator): string {
  const t = String(f.type).toLowerCase();
  const v = f.value.trim();
  if (t === "xpath" || v.startsWith("//") || v.startsWith("(")) {
    const x = v.replace(/^xpath=/i, "");
    return `xpath=${x}`;
  }
  if (t === "name") return `[name="${v.replace(/"/g, '\\"')}"]`;
  if (t === "id") return v.startsWith("#") ? v : `#${v}`;
  if (t === "data-testid") {
    if (v.startsWith("[")) return v;
    return `[data-testid="${v.replace(/"/g, '\\"')}"]`;
  }
  if (t === "accessibilityid" || t === "accessibility id") {
    if (v.startsWith("[")) return v;
    return `[aria-label="${v.replace(/"/g, '\\"')}"]`;
  }
  return v;
}

async function validateLocatorVisible(
  url: string,
  loc: FallbackLocator,
  localeMode: PlaywrightLocaleMode
): Promise<boolean> {
  let browser: Browser;
  try {
    browser = await getSharedBrowser();
  } catch {
    await resetPlaywrightBrowser();
    return false;
  }
  const { locale, acceptLanguage, gotoUrl } = resolvePlaywrightLocale(url, localeMode);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale,
    extraHTTPHeaders: { "Accept-Language": acceptLanguage },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  try {
    const page = await context.newPage();
    await page.goto(gotoUrl, { waitUntil: "domcontentloaded", timeout: NAV_MS });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);
    const sel = toPlaywrightSelector(loc);
    const handle = page.locator(sel).first();
    return await handle.isVisible({ timeout: 4500 }).catch(() => false);
  } catch {
    return false;
  } finally {
    await context.close().catch(() => undefined);
  }
}

function buildKatalonSnippet(loc: FallbackLocator): string {
  const t = String(loc.type).toLowerCase();
  const v = loc.value.replace(/'/g, "\\'");
  if (t === "xpath") return `addProperty('xpath', ConditionType.EQUALS, '${v.replace(/^xpath=/i, "")}')`;
  if (t === "name") return `addProperty('name', ConditionType.EQUALS, '${v}')`;
  if (t === "id") return `addProperty('id', ConditionType.EQUALS, '${v.replace(/^#/, "")}')`;
  if (t === "css") return `addProperty('css', ConditionType.EQUALS, '${v}')`;
  if (t === "data-testid")
    return `addProperty('css', ConditionType.EQUALS, '[data-testid="${v}"]')`;
  return `addProperty('css', ConditionType.EQUALS, '${v}')`;
}

/**
 * Self-healing pipeline: memory → rule-based Playwright extractions → validate → AI (Ollama) last.
 */
export async function runLocatorHealing(req: LocatorHealingRequest): Promise<LocatorHealingResult> {
  const maxRetries = Math.min(8, Math.max(1, req.maxRetries ?? 3));
  const warnings: string[] = [];
  const failure: FailureReport = req.failure;
  const localeMode: PlaywrightLocaleMode = "auto";

  if (!req.url?.trim()) {
    return {
      success: false,
      attempts: [],
      ruleBasedCandidates: [],
      aiUsed: false,
      aiCandidates: [],
      warnings: ["url is required"],
      memoryUpdated: false,
    };
  }

  const mem = await lookupHealingMemory({
    url: req.url,
    stepId: failure.stepId,
    failedLocator: failure.failedLocator,
    domSnapshot: failure.domSnapshot,
  });

  const original: FallbackLocator = {
    type: failure.failedLocator.type,
    value: failure.failedLocator.value,
    score: 100,
    source: "rule",
  };

  let ruleBased: FallbackLocator[] = [];
  try {
    ruleBased = await generateRuleBasedFallbacks({
      url: req.url,
      failedLocator: failure.failedLocator,
      localeMode,
    });
  } catch (e) {
    warnings.push(`Rule-based extraction: ${e instanceof Error ? e.message : String(e)}`);
  }

  let ordered: FallbackLocator[] = [];
  if (mem) {
    ordered.push(mem);
  }
  ordered.push(original);
  for (const r of ruleBased) {
    if (!ordered.some((x) => x.type === r.type && x.value === r.value)) {
      ordered.push(r);
    }
  }

  const seen = new Set<string>();
  ordered = ordered.filter((x) => {
    const k = `${x.type}:${x.value}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  ordered = ordered.slice(0, maxRetries + 2);

  const attempts: LocatorHealingResult["attempts"] = [];
  let aiUsed = false;
  let aiCandidates: FallbackLocator[] = [];

  const tryOne = async (loc: FallbackLocator) => {
    const ok = await validateLocatorVisible(req.url, loc, localeMode);
    attempts.push({ locator: loc, success: ok });
    return ok;
  };

  let winner: FallbackLocator | null = null;
  for (const loc of ordered.slice(0, maxRetries)) {
    if (await tryOne(loc)) {
      winner = loc;
      break;
    }
  }

  if (!winner && !req.skipAi) {
    aiUsed = true;
    try {
      aiCandidates = await repairLocatorsWithOllama({
        url: req.url,
        action: failure.action,
        failedLocator: failure.failedLocator,
        domSnapshot: failure.domSnapshot,
      });
    } catch (e) {
      warnings.push(`AI repair failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    for (const loc of aiCandidates) {
      if (await tryOne(loc)) {
        winner = loc;
        break;
      }
    }
  }

  let memoryUpdated = false;
  if (winner) {
    await saveHealingSuccess({
      url: req.url,
      stepId: failure.stepId,
      failedLocator: failure.failedLocator,
      domSnapshot: failure.domSnapshot,
      winning: winner,
    });
    memoryUpdated = true;
  }

  return {
    success: Boolean(winner),
    winningLocator: winner ?? undefined,
    attempts,
    ruleBasedCandidates: ruleBased,
    aiUsed,
    aiCandidates,
    warnings,
    suggestedKatalonSnippet: winner ? buildKatalonSnippet(winner) : undefined,
    memoryUpdated,
  };
}

export { classifyErrorMessage };
