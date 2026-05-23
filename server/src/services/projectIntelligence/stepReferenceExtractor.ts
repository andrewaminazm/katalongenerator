import { normalizeLocatorHint } from "../katalonCompiler/locatorResolve.js";
import { parseStepLine } from "../katalonCompiler/stepParser.js";

/** Strip leading step numbers like `1-` or `2.` */
export function stripStepNumberPrefix(step: string): string {
  return step.replace(/^\s*\d+[\s.\):\-]+/, "").trim();
}

/** Locator hint for click/type steps (aligned with stepParser / intentParser). */
export function extractLocatorHintFromStep(step: string, platform: "web" | "mobile"): string | null {
  const cleaned = stripStepNumberPrefix(step);
  if (!cleaned) return null;
  const intent = parseStepLine(cleaned, platform);
  if (intent.kind === "click" || intent.kind === "tap") return intent.targetHint?.trim() || null;
  if (intent.kind === "setText" || intent.kind === "mobileSetText") return intent.targetHint?.trim() || null;
  if (intent.kind === "check" || intent.kind === "uncheck") return intent.targetHint?.trim() || null;
  if (intent.kind === "verifyElementVisible") return intent.targetHint?.trim() || null;
  return null;
}

/** `label = Page/Path` or `label=//xpath` embedded in a step line. */
export function extractLocatorAssignmentFromStep(step: string): { label: string; rhs: string } | null {
  const cleaned = stripStepNumberPrefix(step);
  const m = cleaned.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/);
  if (!m) return null;
  const label = m[1].trim();
  const rhs = m[2].trim();
  if (!label || !rhs) return null;
  if (/^(click|tap|type|use|call|keyword)\b/i.test(label)) return null;
  return { label, rhs };
}

/** OR path in step: `Page_Login/btn` or `findTestObject('…')`. */
export function extractOrPathFromStep(step: string): string | null {
  const cleaned = stripStepNumberPrefix(step);
  const ft = cleaned.match(/findTestObject\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (ft?.[1]) return ft[1].trim();
  const bare = cleaned.match(
    /\b((?:Object Repository\/)?[A-Za-z0-9_][\w\-]*(?:\/[A-Za-z0-9_][\w\-]*)+)\b/
  );
  if (bare?.[1] && bare[1].includes("/")) {
    let p = bare[1].trim();
    if (/^Object Repository\//i.test(p)) p = p.replace(/^Object Repository\//i, "");
    return p;
  }
  return null;
}

/** `package.Class.method` with no spaces — e.g. `common.WebUiHelpers.openToUrl`. */
export function extractBareKeywordRefFromStep(step: string): string | null {
  const cleaned = stripStepNumberPrefix(step).trim();
  if (!cleaned || /\s/.test(cleaned)) return null;
  if (!/^[\w][\w.]*\.[A-Za-z]\w*$/.test(cleaned)) return null;
  if (!cleaned.includes(".")) return null;
  const parts = cleaned.split(".");
  if (parts.length < 2) return null;
  return cleaned;
}

/** Keyword ref: `use keyword LoginKeywords.login`, `CustomKeywords.'a.b.c'`, `keyword: a.b.c`. */
/** Literal args from `Class.method("arg")` on a keyword step line. */
export function extractKeywordArgsFromStep(step: string): string[] {
  const cleaned = stripStepNumberPrefix(step).trim();
  const m = cleaned.match(/\.([A-Za-z]\w*)\s*\(([^)]*)\)\s*$/);
  if (!m?.[2]) return [];
  const inner = m[2].trim();
  if (!inner) return [];
  const quoted = inner.match(/^["']([^"']*)["']$/);
  if (quoted) return [quoted[1]];
  return [inner];
}

export function extractKeywordRefFromStep(step: string): string | null {
  const cleaned = stripStepNumberPrefix(step);
  const ck = cleaned.match(/CustomKeywords\s*\.\s*'([^']+)'/i);
  if (ck?.[1]) return ck[1].trim();
  const m =
    cleaned.match(/\b(?:use|call)\s+(?:the\s+)?keyword\s+(.+)$/i) ??
    cleaned.match(/\bkeyword\s*:\s*(.+)$/i);
  if (m?.[1]) return m[1].trim().replace(/\s*\([^)]*\)\s*$/, "");
  return extractBareKeywordRefFromStep(step);
}

export function normalizeLocatorKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/_/g, " ");
}

export function compactLocatorKey(s: string): string {
  return normalizeLocatorKey(s).replace(/\s+/g, "");
}
