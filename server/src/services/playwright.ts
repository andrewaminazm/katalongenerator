import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium, type Browser } from "playwright";
import {
  type PlaywrightLocaleMode,
  resolvePlaywrightLocale,
} from "./playwrightLocale.js";

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
  type: "button" | "input" | "link" | "text" | "logo" | "image" | "icon" | "bgimage" | "unknown";
  text?: string;
  tag?: string;
  src?: string;
  alt?: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

/** Max candidates collected from the page before step-based filtering. */
const MAX_LOCATORS = 600;
const NAV_TIMEOUT_MS = 10_000;

let browserSingleton: Promise<Browser> | null = null;

/** @internal Exported for self-healing / advanced Playwright flows. */
export async function getSharedBrowser(): Promise<Browser> {
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
  tag?: string;
  src?: string;
  alt?: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
};

function rankForKeywords(r: LocatorResult): number {
  const blob = `${r.name} ${r.text ?? ""}`.toLowerCase();
  let score = 0;
  if (/\blogin\b|\bsign\s*in\b|\bsubmit\b|\bcontinue\b|\bsearch\b/.test(blob)) score += 12;
  if (/\bpassword\b|\busername\b|\bemail\b/.test(blob)) score += 8;
  if (/\b(logo|brand|branding|icon|image|banner|svg)\b/.test(blob)) score += 10;
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

/** Words removed when matching step text to locator names/selectors (reduces noise). */
const STEP_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "on",
  "in",
  "at",
  "to",
  "for",
  "and",
  "or",
  "then",
  "click",
  "tap",
  "press",
  "button",
  "link",
  "field",
  "box",
  "user",
  "step",
  "open",
  "visit",
  "navigate",
  "page",
  "site",
  "url",
  "test",
  "gosi",
  "http",
  "https",
  "www",
  "com",
  "net",
  "org",
  "gov",
  "sa",
  "ar",
  "en",
]);

function stepIsNavigationOnly(step: string): boolean {
  const s = step.trim();
  if (!s) return true;
  if (
    /^https?:\/\/\S+/i.test(s) &&
    !/\b(click|tap|type|enter|verify|assert|fill|select|check|press|choose)\b/i.test(s)
  ) {
    return true;
  }
  if (
    /\b(visit|open|navigate|go\s+to)\b/i.test(s) &&
    /https?:\/\//i.test(s) &&
    !/\b(click|tap|type|enter|verify|assert|fill|select|check|press|choose)\b/i.test(s)
  ) {
    return true;
  }
  return false;
}

function stepNeedsElementLocator(step: string): boolean {
  if (stepIsNavigationOnly(step)) return false;
  return (
    /\b(click|tap|double|type|enter|fill|select|choose|check|uncheck|toggle|submit|search|verify|assert|expect|wait|press|scroll)\b/i.test(
      step
    ) ||
    /\b(open\s+(the\s+)?(menu|dialog|dropdown))\b/i.test(step) ||
    /[\u0600-\u06FF]{2,}/.test(step)
  );
}

/** Arabic phrases in a step (for matching xpath text= / normalize-space locators). */
export function extractArabicSequences(step: string): string[] {
  const re = /[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+)*/g;
  const parts = step.match(re);
  if (!parts) return [];
  return [
    ...new Set(
      parts
        .map((p) => p.replace(/\s+/g, " ").trim())
        .filter((p) => p.length >= 2)
    ),
  ];
}

function tokenizeForLocatorMatch(step: string): string[] {
  const cleaned = step
    .replace(/^\s*\d+[-.)]\s*/, "")
    .replace(/https?:\/\/\S+/gi, " ")
    .toLowerCase();
  const raw = cleaned.split(/[^\w\u0600-\u06FF]+/);
  const out: string[] = [];
  for (const t of raw) {
    const x = t.trim();
    if (x.length < 2) continue;
    if (STEP_STOPWORDS.has(x)) continue;
    out.push(x);
  }
  return [...new Set(out)];
}

function scoreLocatorForStep(loc: LocatorResult, step: string): number {
  const blob = `${loc.name}\n${loc.text ?? ""}\n${loc.selector}`.toLowerCase();
  let score = 0;
  for (const t of tokenizeForLocatorMatch(step)) {
    if (t.length < 2) continue;
    if (blob.includes(t)) score += 10;
  }
  if (/\bcontact\b/i.test(step) && /\bcontact|btn-contact|touch|call|اتصل|تواصل/i.test(blob))
    score += 35;
  if (/\b(login|sign\s*in)\b/i.test(step) && /\blogin|signin|sign-in|دخول/i.test(blob)) score += 35;
  if (/\b(search|find)\b/i.test(step) && /\bsearch|query|q=|magnif/i.test(blob)) score += 22;
  if (/\bsubmit\b/i.test(step) && /\bsubmit|send|confirm|حفظ|إرسال/i.test(blob)) score += 22;
  for (const ar of extractArabicSequences(step)) {
    if (ar.length < 2) continue;
    if (
      loc.selector.includes(ar) ||
      (loc.text && loc.text.includes(ar)) ||
      loc.name.includes(ar)
    ) {
      score += 45;
    }
  }
  return score;
}

/**
 * Keeps auto-detected locators that match the **test steps** (e.g. contact for
 * "click contact button"), instead of listing every link on the page.
 */
export function filterLocatorsBySteps(locators: LocatorResult[], steps: string[]): LocatorResult[] {
  const trimmed = steps.map((s) => String(s).trim()).filter(Boolean);
  if (!trimmed.length) {
    const sorted = [...locators].sort((a, b) => rankForKeywords(b) - rankForKeywords(a));
    return sorted.slice(0, 40);
  }

  const actionSteps = trimmed.filter(stepNeedsElementLocator);
  if (!actionSteps.length) {
    return [];
  }

  const bestBySelector = new Map<string, { loc: LocatorResult; score: number }>();

  for (const step of actionSteps) {
    const ranked = locators
      .map((loc) => ({ loc, score: scoreLocatorForStep(loc, step) }))
      .sort((a, b) => b.score - a.score);

    const strongThreshold = 8;
    const moderateMin = 4;
    const strong = ranked.filter((x) => x.score >= strongThreshold).slice(0, 8);
    const moderate = ranked.filter(
      (x) => x.score >= moderateMin && x.score < strongThreshold
    ).slice(0, 6);
    // Never use score-0 "top N" picks — they are arbitrary DOM order and make the LLM
    // click unrelated controls (e.g. wrong Arabic aria-label vs. the step text).
    const picks = strong.length > 0 ? strong : moderate;

    for (const { loc, score } of picks) {
      const prev = bestBySelector.get(loc.selector);
      if (!prev || score > prev.score) {
        bestBySelector.set(loc.selector, { loc, score });
      }
    }
  }

  let out = [...bestBySelector.values()]
    .sort((a, b) => b.score - a.score)
    .map((x) => x.loc);

  out = dedupeBySelector(out);

  if (out.length === 0) {
    const anyArabicAction = actionSteps.some((s) => extractArabicSequences(s).length > 0);
    if (anyArabicAction) {
      return [];
    }
    const sorted = [...locators].sort((a, b) => rankForKeywords(b) - rankForKeywords(a));
    return sorted.slice(0, 12);
  }

  return out.slice(0, 40);
}

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

export async function extractLocators(
  url: string,
  localeMode: PlaywrightLocaleMode = "auto"
): Promise<LocatorResult[]> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL must use http or https");
  }

  const { locale, acceptLanguage, gotoUrl } = resolvePlaywrightLocale(url, localeMode);

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
    locale,
    extraHTTPHeaders: {
      "Accept-Language": acceptLanguage,
    },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  try {
    const page = await context.newPage();
    await page.goto(gotoUrl, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT_MS,
    });
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => undefined);

    // String form avoids tsx/esbuild injecting __name into nested functions (breaks in browser).
    const raw = await page.evaluate(getLocatorExtractorSource());

    if (!Array.isArray(raw)) {
      throw new Error(
        `Locator extractor did not return an array (got ${raw === undefined ? "undefined" : typeof raw}). ` +
          "Ensure extractLocators.inbrowser.js ends with an IIFE that returns the locator list, e.g. (() => { ...; return out; })()."
      );
    }

    const typed: LocatorResult[] = (raw as RawLocator[]).map((r) => ({
      name: r.name,
      selector: r.selector,
      type: (["button", "input", "link", "text", "logo", "image", "icon", "bgimage", "unknown"].includes(r.type)
        ? r.type
        : "unknown") as LocatorResult["type"],
      text: r.text,
      tag: r.tag,
      src: r.src,
      alt: r.alt,
      title: r.title,
      ariaLabel: r.ariaLabel,
      className: r.className,
      id: r.id,
      boundingBox: r.boundingBox,
    }));

    const deduped = dedupeBySelector(typed);
    /* Keep DOM/collection order — do not pre-sort by generic "login" keywords or step-relevant
       controls (e.g. contact) may rank low and be sliced away before step filtering. */
    return deduped.slice(0, MAX_LOCATORS);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Playwright extraction failed: ${msg}`);
  } finally {
    await context.close().catch(() => undefined);
  }
}
