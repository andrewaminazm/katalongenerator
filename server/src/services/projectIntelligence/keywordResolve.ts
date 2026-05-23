import type { ParsedKeywordClass, ParsedKeywordMethod } from "./types.js";
import { formatKeywordCall, type KeywordCallOptions } from "./keywordParser.js";
import { extractKeywordRefFromStep } from "./stepReferenceExtractor.js";

function normalizeKeywordToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function keywordPathSegments(s: string): string[] {
  return s
    .trim()
    .replace(/^CustomKeywords\s*\.\s*'?|'?$/gi, "")
    .split(".")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

function keywordPathsMatch(a: string, b: string): boolean {
  if (normalizeKeywordToken(a) === normalizeKeywordToken(b)) return true;
  const sa = keywordPathSegments(a);
  const sb = keywordPathSegments(b);
  if (sa.length !== sb.length || sa.length === 0) return false;
  return sa.every((seg, i) => seg === sb[i]);
}

/** Pick a sensible default @Keyword when the user names only the class (e.g. common.WebUiHelpers). */
export function pickDefaultKeywordMethod(kw: ParsedKeywordClass): ParsedKeywordMethod | null {
  if (!kw.methods.length) return null;
  const prefer = [
    "openToUrl",
    "openBrowser",
    "launchBrowser",
    "login",
    "navigateTo",
    "open",
    "start",
  ];
  for (const name of prefer) {
    const hit = kw.methods.find((m) => m.name.toLowerCase() === name.toLowerCase());
    if (hit) return hit;
  }
  return kw.methods[0];
}

/**
 * Resolve `common.WebUiHelpers`, `common.WebUiHelpers.openToUrl`, or `CustomKeywords.'…'` refs.
 */
export function resolveKeywordRef(
  ref: string,
  keywords: ParsedKeywordClass[]
): { kw: ParsedKeywordClass; method: ParsedKeywordMethod } | null {
  const trimmed = ref.trim().replace(/^CustomKeywords\s*\.\s*'?|'?$/gi, "").trim();
  if (!trimmed) return null;

  const compactRef = normalizeKeywordToken(trimmed);
  const lower = trimmed.toLowerCase();

  for (const kw of keywords) {
    for (const method of kw.methods) {
      const full = `${kw.customKeywordsPath}.${method.name}`;
      if (
        lower === full.toLowerCase() ||
        lower === `${kw.className}.${method.name}`.toLowerCase() ||
        normalizeKeywordToken(full) === compactRef ||
        keywordPathsMatch(trimmed, full)
      ) {
        return { kw, method };
      }
    }
  }

  // Method-only: safeCloseBrowser, openToUrl (optional parens stripped earlier)
  const methodOnly = trimmed.replace(/\(\).*$/, "").trim();
  if (methodOnly && !methodOnly.includes(".")) {
    const lowerMethod = methodOnly.toLowerCase();
    const hits: { kw: ParsedKeywordClass; method: ParsedKeywordMethod }[] = [];
    for (const kw of keywords) {
      for (const method of kw.methods) {
        if (method.name.toLowerCase() === lowerMethod) {
          hits.push({ kw, method });
        }
      }
    }
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      const prefer = hits.find(
        (h) =>
          /webuihelper/i.test(h.kw.className) ||
          /webuihelper/i.test(h.kw.customKeywordsPath)
      );
      return prefer ?? hits[0];
    }
  }

  for (const kw of keywords) {
    const pathCompact = normalizeKeywordToken(kw.customKeywordsPath);
    const classCompact = normalizeKeywordToken(kw.className);
    const matchesClass =
      pathCompact === compactRef ||
      classCompact === compactRef ||
      kw.customKeywordsPath.toLowerCase() === lower ||
      kw.className.toLowerCase() === lower ||
      lower.endsWith(`.${kw.className.toLowerCase()}`) ||
      compactRef.endsWith(classCompact);

    if (matchesClass) {
      const method = pickDefaultKeywordMethod(kw);
      if (method) return { kw, method };
    }
  }

  return null;
}

export function formatResolvedKeywordCall(
  resolved: { kw: ParsedKeywordClass; method: ParsedKeywordMethod },
  options?: KeywordCallOptions
): string {
  return formatKeywordCall(resolved.kw, resolved.method, options);
}

/** Heuristic: step opens browser via a custom keyword (skip duplicate WebUI.openBrowser insert). */
export function stepLineImpliesBrowserKeyword(step: string): boolean {
  const ref = extractKeywordRefFromStep(step);
  if (ref) return true;
  const bare = step.replace(/^\s*\d+[\s.\):\-]+/, "").trim();
  return (
    /^[\w][\w.]*\.[A-Za-z]\w*$/i.test(bare) &&
    /\b(open|launch|browser|url|navigate|start)\b/i.test(bare)
  );
}
