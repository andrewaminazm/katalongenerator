import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, type Browser } from "playwright";

const __pwDir = path.dirname(fileURLToPath(import.meta.url));

let cachedLocatorExtractorSource: string | null = null;

function getLocatorExtractorSource(): string {
  if (cachedLocatorExtractorSource) return cachedLocatorExtractorSource;
  const p = path.join(__pwDir, "extractLocators.inbrowser.js");
  if (!existsSync(p)) {
    throw new Error(
      "Missing extractLocators.inbrowser.js (expected next to playwright.ts). Reinstall or run npm run build from server/."
    );
  }
  cachedLocatorExtractorSource = readFileSync(p, "utf8").trim();
  return cachedLocatorExtractorSource;
}

export interface LocatorResult {
  name: string;
  selector: string;
  type: "button" | "input" | "link" | "text" | "unknown";
  text?: string;
}

const MAX_LOCATORS = 100;
const NAV_TIMEOUT_MS = 10_000;

let browserSingleton: Promise<Browser> | null = null;

async function getSharedBrowser(): Promise<Browser> {
  if (!browserSingleton) {
    browserSingleton = chromium.launch({ headless: true });
  }
  try {
    return await browserSingleton;
  } catch (e) {
    browserSingleton = null;
    throw e;
  }
}

/** Reset shared browser after fatal errors (optional recovery). */
export async function resetPlaywrightBrowser(): Promise<void> {
  if (!browserSingleton) return;
  try {
    const b = await browserSingleton;
    await b.close();
  } catch {
    /* noop */
  }
  browserSingleton = null;
}

type RawLocator = {
  name: string;
  selector: string;
  type: string;
  text?: string;
};

function rankForKeywords(r: LocatorResult): number {
  const blob = `${r.name} ${r.text ?? ""}`.toLowerCase();
  let score = 0;
  if (/\blogin\b|\bsign\s*in\b|\bsubmit\b|\bcontinue\b|\bsearch\b/.test(blob)) score += 12;
  if (/\bpassword\b|\busername\b|\bemail\b/.test(blob)) score += 8;
  return score;
}

function dedupeBySelector(items: LocatorResult[]): LocatorResult[] {
  const seen = new Set<string>();
  const out: LocatorResult[] = [];
  for (const item of items) {
    const key = item.selector.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Converts structured locators to the merge format used in prompts:
 * `Human Name = selector`
 */
export function formatLocatorResultsAsLines(results: LocatorResult[]): string {
  const used = new Set<string>();
  const lines: string[] = [];
  for (const r of results) {
    let name = r.name;
    const base = name;
    let n = 1;
    while (used.has(name.toLowerCase())) {
      name = `${base} (${++n})`;
    }
    used.add(name.toLowerCase());
    lines.push(`${name} = ${r.selector}`);
  }
  return lines.join("\n");
}

/**
 * Parses `Label = value` lines; keys are normalized (lowercase trimmed label).
 */
export function parseLocatorLineKeys(locatorsText: string): Set<string> {
  const keys = new Set<string>();
  for (const line of locatorsText.split(/\r?\n/)) {
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const label = line.slice(0, idx).trim().toLowerCase();
    if (label) keys.add(label);
  }
  return keys;
}

/**
 * Merges auto-detected lines after user lines; user labels win (case-insensitive).
 */
export function mergeLocatorTexts(userText: string, autoLines: string): string {
  const userKeys = parseLocatorLineKeys(userText);
  const autoFiltered = autoLines
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      const idx = l.indexOf("=");
      if (idx === -1) return false;
      const label = l.slice(0, idx).trim().toLowerCase();
      return label && !userKeys.has(label);
    });
  const parts = [userText.trim(), autoFiltered.join("\n")].filter(Boolean);
  return parts.join("\n");
}

/** Auto lines whose label is not already defined by the user (for REAL LOCATORS section). */
export function filterAutoLinesNotOverriddenByUser(userText: string, autoLines: string): string {
  const userKeys = parseLocatorLineKeys(userText);
  const lines = autoLines
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => {
      const idx = l.indexOf("=");
      if (idx === -1) return false;
      const label = l.slice(0, idx).trim().toLowerCase();
      return label && !userKeys.has(label);
    });
  return lines.join("\n").trim();
}

export async function extractLocators(url: string): Promise<LocatorResult[]> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL must use http or https");
  }

  let browser: Browser;
  try {
    browser = await getSharedBrowser();
  } catch (e) {
    await resetPlaywrightBrowser();
    throw new Error(
      `Failed to launch browser: ${e instanceof Error ? e.message : String(e)}. Run: npx playwright install chromium`
    );
  }

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  try {
    const page = await context.newPage();
    await page.goto(parsed.href, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);

    // String form avoids tsx/esbuild injecting __name into nested functions (breaks in browser).
    const raw = await page.evaluate(getLocatorExtractorSource());

    const typed: LocatorResult[] = (raw as RawLocator[]).map((r) => ({
      name: r.name,
      selector: r.selector,
      type: (["button", "input", "link", "text", "unknown"].includes(r.type)
        ? r.type
        : "unknown") as LocatorResult["type"],
      text: r.text,
    }));

    const deduped = dedupeBySelector(typed);
    deduped.sort((a, b) => rankForKeywords(b) - rankForKeywords(a));
    return deduped.slice(0, MAX_LOCATORS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Playwright extraction failed: ${msg}`);
  } finally {
    await context.close().catch(() => undefined);
  }
}
