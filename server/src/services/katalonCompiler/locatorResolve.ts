import { buildResolvedLocatorFromRhs } from "./locatorParser.js";
import { matchLocatorByHint } from "./matchLocator.js";
import type { LocatorMatchIntent } from "./matchLocator.js";
import type { ParsedLocatorLine, ResolvedLocator } from "./types.js";

function normKey(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Strips leading filler words so hints like "on search" / "the Submit button" match
 * locator labels such as `Search` / `Submit`.
 */
export function normalizeLocatorHint(hint: string): string {
  let s = hint.trim().replace(/\s+/g, " ");
  for (let i = 0; i < 8; i++) {
    const next = s.replace(/^(on|in|at|to|for|from|onto|into|the|a|an)\s+/i, "").trim();
    if (next === s) break;
    s = next;
  }
  return s;
}

/** Human/recorder step text like `Label (#id)` or `إغلاق الاستبيان (button.x)` — label is display text, selector drives execution. */
export function extractSelectorFromHint(hint: string): { label: string; selector: string } | null {
  const raw = hint.trim();
  if (!raw) return null;
  // Common recorder / human formats: "Click Login (#btn-login)" / "Tap Submit (//xpath)".
  const m = raw.match(/\(([^()]+)\)\s*$/);
  if (!m) return null;
  const selector = m[1].trim();
  const label = raw.slice(0, m.index).trim().replace(/\s+/g, " ");
  if (!label || !selector) return null;
  // Very light sanity: prefer strings that look like selectors.
  if (
    selector.startsWith("#") ||
    selector.startsWith(".") ||
    selector.startsWith("//") ||
    selector.startsWith("(") ||
    /^xpath=/i.test(selector) ||
    /^\[.+\]$/.test(selector) ||
    /[>#\[\]=:'"]/.test(selector)
  ) {
    return { label, selector };
  }
  return null;
}

function lookupRecording(
  hint: string,
  recordingSelectors?: Record<string, string>
): string | undefined {
  if (!recordingSelectors) return undefined;
  const trimmed = hint.trim();
  const h = normKey(trimmed);
  const direct = recordingSelectors[trimmed];
  if (direct?.trim()) return direct.trim();
  const entry = Object.entries(recordingSelectors).find(([k]) => normKey(k) === h);
  if (entry?.[1]?.trim()) return entry[1].trim();

  // Arabic / mixed scripts: keys may differ by Unicode normalization (NFC vs NFD).
  const hintNfc = trimmed.normalize("NFC");
  const nfcDirect = recordingSelectors[hintNfc];
  if (nfcDirect?.trim()) return nfcDirect.trim();
  const nfcEntry = Object.entries(recordingSelectors).find(
    ([k]) => k.trim().normalize("NFC") === hintNfc
  );
  return nfcEntry?.[1]?.trim();
}

function xpathLiteralForContains(text: string): string {
  const t = text.trim();
  if (!t.includes("'")) return `'${t}'`;
  if (!t.includes('"')) return `"${t}"`;
  return `"${t.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Last-resort TestObject when no OR line matches — text-based XPath (always emits code).
 */
export function buildFallbackResolvedLocator(hint: string, pageUrl?: string): ResolvedLocator | null {
  const h = hint.trim() || "element";
  const safeLabel = `fb_${h.slice(0, 40).replace(/[^\w\u0600-\u06FF]+/g, "_")}` || "fb_el";
  const rhs = `//*[contains(normalize-space(.),${xpathLiteralForContains(h)})]`;
  const loc = buildResolvedLocatorFromRhs(safeLabel, rhs, true, { pageUrl });
  return loc ? { ...loc, recordingFallback: true } : null;
}

export type { LocatorMatchIntent } from "./matchLocator.js";

function tryResolveLocatorHint(
  hint: string,
  resolved: ResolvedLocator[],
  parsedLines: ParsedLocatorLine[],
  recordingSelectors?: Record<string, string>,
  pageUrl?: string,
  matchIntent?: LocatorMatchIntent
): ResolvedLocator | null {
  const h = hint.trim();
  if (!h) return null;

  const pwCtx = { pageUrl };

  const exact = resolved.find((l) => normKey(l.label) === normKey(h));
  if (exact) return { ...exact, recordingFallback: false };

  const pl = parsedLines.find((p) => normKey(p.label) === normKey(h));
  if (pl) {
    const loc = buildResolvedLocatorFromRhs(pl.label, pl.rhs, false, pwCtx);
    if (loc) return loc;
  }

  const rec = lookupRecording(h, recordingSelectors);
  if (rec) {
    const loc = buildResolvedLocatorFromRhs(h, rec, true, pwCtx);
    if (loc) return loc;
  }

  // Last-chance: selector embedded in the step text itself (e.g. "Click X (#id)").
  const embedded = extractSelectorFromHint(h);
  if (embedded) {
    const loc = buildResolvedLocatorFromRhs(embedded.label, embedded.selector, true, pwCtx);
    if (loc) return loc;
  }

  const mapIntent =
    matchIntent === "click" || matchIntent === "type" || matchIntent === "check" || matchIntent === "verify"
      ? matchIntent
      : undefined;
  const fuzzy = matchLocatorByHint(h, resolved, mapIntent ? { intent: mapIntent } : undefined);
  if (fuzzy) return { ...fuzzy, recordingFallback: false };

  return null;
}

/**
 * Resolve a TestObject hint: OR table → parsed line → recorded selector → fuzzy.
 * Never returns undefined when a recorded selector exists for the label.
 */
export function resolveLocatorWithFallbacks(
  hint: string,
  resolved: ResolvedLocator[],
  parsedLines: ParsedLocatorLine[],
  recordingSelectors?: Record<string, string>,
  pageUrl?: string,
  matchIntent?: LocatorMatchIntent
): ResolvedLocator | null {
  const primary = hint.trim();
  if (!primary) return null;

  const normalized = normalizeLocatorHint(primary);
  return (
    tryResolveLocatorHint(primary, resolved, parsedLines, recordingSelectors, pageUrl, matchIntent) ??
    (normalized !== primary
      ? tryResolveLocatorHint(normalized, resolved, parsedLines, recordingSelectors, pageUrl, matchIntent)
      : null)
  );
}
