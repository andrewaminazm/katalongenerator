import type { Browser } from "playwright";
import { resolvePlaywrightLocale, type PlaywrightLocaleMode } from "../playwrightLocale.js";
import { getSharedBrowser, resetPlaywrightBrowser } from "../playwright.js";
import { scoreHealingCandidate } from "./healingScorer.js";
import type { FallbackLocator, LocatorRef } from "./types.js";

const NAV_MS = 12_000;

function toPwSelector(ref: LocatorRef): string {
  const t = ref.type.toLowerCase();
  const v = ref.value.trim();
  if (t === "xpath" || v.startsWith("//") || v.startsWith("(")) {
    const x = v.replace(/^xpath=/i, "");
    return `xpath=${x}`;
  }
  if (t === "name") return `[name="${v.replace(/"/g, '\\"')}"]`;
  if (t === "id") return v.startsWith("#") ? v : `#${v}`;
  return v;
}

function buildCandidatesFromElement(el: {
  tag: string;
  id: string;
  name: string | null;
  dataTestId: string | null;
  ariaLabel: string | null;
  role: string | null;
}): { type: FallbackLocator["type"]; value: string }[] {
  const out: { type: FallbackLocator["type"]; value: string }[] = [];
  if (el.id) out.push({ type: "id", value: `#${el.id}` });
  if (el.name) out.push({ type: "name", value: el.name });
  if (el.dataTestId) out.push({ type: "data-testid", value: `[data-testid="${el.dataTestId}"]` });
  if (el.ariaLabel) {
    out.push({
      type: "accessibilityId",
      value: `[aria-label="${el.ariaLabel.replace(/"/g, '\\"')}"]`,
    });
  }
  if (el.tag === "button" && el.role === "button") {
    /* already covered by css below */
  }
  return out;
}

/**
 * Opens URL, resolves the failed element, extracts alternative locators, returns top 3 by score.
 */
export async function generateRuleBasedFallbacks(options: {
  url: string;
  failedLocator: LocatorRef;
  localeMode?: PlaywrightLocaleMode;
}): Promise<FallbackLocator[]> {
  const { url, failedLocator } = options;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return [];
  }
  if (!["http:", "https:"].includes(parsed.protocol)) return [];

  const { locale, acceptLanguage, gotoUrl } = resolvePlaywrightLocale(url, options.localeMode ?? "auto");

  let browser: Browser;
  try {
    browser = await getSharedBrowser();
  } catch {
    await resetPlaywrightBrowser();
    throw new Error("Playwright browser unavailable. Run: npx playwright install chromium");
  }

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

    const sel = toPwSelector(failedLocator);
    const loc = page.locator(sel).first();
    const count = await loc.count().catch(() => 0);
    if (count === 0) {
      return [];
    }

    const attrs = await loc.evaluate((el: Element) => {
      const h = el as HTMLElement;
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || "",
        name: el.getAttribute("name"),
        dataTestId: el.getAttribute("data-testid"),
        ariaLabel: el.getAttribute("aria-label"),
        role: el.getAttribute("role"),
      };
    });

    const raw = buildCandidatesFromElement(attrs);

    const xpath = await loc.evaluate((el: Element) => {
      const getXPath = (node: Node): string => {
        if (node.nodeType !== Node.ELEMENT_NODE) return "";
        const el = node as Element;
        if (el.id) return `//*[@id="${el.id}"]`;
        if (el === document.body) return "/html/body";
        const parent = el.parentNode;
        if (!parent) return el.tagName.toLowerCase();
        const siblings = Array.from(parent.children).filter((c) => c.tagName === el.tagName);
        const idx = siblings.indexOf(el) + 1;
        const path = getXPath(parent);
        return `${path}/${el.tagName.toLowerCase()}[${idx}]`;
      };
      try {
        return getXPath(el);
      } catch {
        return "";
      }
    });

    if (xpath && xpath.length < 400) {
      raw.push({ type: "xpath", value: xpath });
    }

    const cssFallback = await loc.evaluate((el: Element) => {
      const tag = el.tagName.toLowerCase();
      const cls = (el.className && typeof el.className === "string" ? el.className : "")
        .split(/\s+/)
        .filter((c) => c.length > 0 && !/^css-|^sc-|^Mui/.test(c))
        .slice(0, 2);
      if (cls.length) return `${tag}.${cls.join(".")}`;
      return tag;
    });
    if (cssFallback && cssFallback !== attrs.tag) {
      raw.push({ type: "css", value: cssFallback });
    }

    const scored: FallbackLocator[] = raw.map((r) => ({
      type: r.type,
      value: r.value,
      score: scoreHealingCandidate(String(r.type), r.value),
      source: "rule" as const,
    }));

    scored.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const uniq: FallbackLocator[] = [];
    for (const s of scored) {
      const k = `${s.type}:${s.value}`;
      if (seen.has(k)) continue;
      seen.add(k);
      uniq.push(s);
      if (uniq.length >= 3) break;
    }
    return uniq;
  } finally {
    await context.close().catch(() => undefined);
  }
}
