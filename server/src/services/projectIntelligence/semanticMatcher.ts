import type {
  ParsedKeywordClass,
  ParsedKeywordMethod,
  ParsedTestObject,
  ParsedTestScript,
  SemanticMatchResult,
} from "./types.js";

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function dice(a: string, b: string): number {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  if (!A.length || !B.length) return 0;
  if (A === B) return 1;
  if (A.length < 2 || B.length < 2) return A === B ? 1 : 0;
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const bgA = bigrams(A);
  const bgB = bigrams(B);
  let inter = 0;
  for (const [k, va] of bgA) {
    if (!bgB.has(k)) continue;
    inter += Math.min(va, bgB.get(k)!);
  }
  const denom = A.length - 1 + (B.length - 1);
  return denom === 0 ? 0 : (2 * inter) / denom;
}

function applySynonyms(s: string): string {
  return s
    .replace(/\b(sign\s*in|sign-in|log\s*in)\b/gi, "login")
    .replace(/\b(log\s*out|sign\s*out)\b/gi, "logout")
    .replace(/\bportal\b/gi, "application");
}

export function scoreStepAgainstText(step: string, corpus: string): number {
  const s = applySynonyms(step);
  const c = applySynonyms(corpus);
  const td = dice(s, c);
  const stepTokens = new Set(tokenize(s));
  const corpTokens = tokenize(c);
  let overlap = 0;
  for (const t of corpTokens) {
    if (stepTokens.has(t)) overlap++;
  }
  const overlapScore = corpTokens.length ? overlap / corpTokens.length : 0;
  return Math.min(1, td * 0.55 + overlapScore * 0.45);
}

/** Lowercase, collapse spaces only — keeps underscores/hyphens for Katalon OR names. */
function locatorKeyCompact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

function pathLeaf(path: string): string {
  return path.split("/").pop()?.trim() ?? "";
}

/**
 * Exact Object Repository match for a locator name the user typed (e.g. button_Show more-board).
 */
export function findTestObjectExactMatch(
  hint: string,
  objects: ParsedTestObject[]
): ParsedTestObject | null {
  const h = hint.trim();
  if (!h) return null;
  const hLower = h.toLowerCase();
  const hCompact = locatorKeyCompact(h);

  for (const obj of objects) {
    const labelLower = obj.label.toLowerCase();
    if (labelLower === hLower) return obj;

    const labelCompact = locatorKeyCompact(obj.label);
    if (labelCompact === hCompact) return obj;

    const leaf = pathLeaf(obj.path).toLowerCase();
    if (leaf === hLower) return obj;
    if (locatorKeyCompact(leaf) === hCompact) return obj;

    const pathLower = obj.path.toLowerCase();
    if (pathLower === hLower || pathLower.endsWith(`/${hLower}`)) return obj;
  }
  return null;
}

function isWeakPrefixLabel(label: string, hint: string): boolean {
  const l = label.toLowerCase().trim();
  const h = hint.toLowerCase().trim();
  if (l.length < 2 || l.length >= h.length) return false;
  if (!h.startsWith(l)) return false;
  // Truncated Katalon names like `button_` vs `button_Show more-board`
  if (l.endsWith("_") || l.endsWith("-")) return true;
  const next = h[l.length];
  return next === "_" || next === "-" || next === " " || next === "/";
}

/** True when an OR label/path leaf is only a prefix of the user's locator name (e.g. button_ vs button_Show more-board). */
export function isWeakPrefixOrMatch(hint: string, obj: ParsedTestObject): boolean {
  return isWeakPrefixLabel(obj.label, hint) || isWeakPrefixLabel(pathLeaf(obj.path), hint);
}

function scoreObjectAgainstHint(hint: string, obj: ParsedTestObject): number {
  const h = hint.trim();
  if (!h) return 0;
  const hNorm = h.toLowerCase();
  const labelNorm = obj.label.toLowerCase();
  if (labelNorm === hNorm) return 1;
  if (obj.path.toLowerCase() === hNorm || obj.path.toLowerCase().endsWith(`/${hNorm}`)) return 0.98;

  const hCompact = locatorKeyCompact(h);
  const labelCompact = locatorKeyCompact(obj.label);
  if (labelCompact === hCompact) return 0.97;

  const leaf = pathLeaf(obj.path);
  const leafCompact = locatorKeyCompact(leaf);
  if (leafCompact === hCompact) return 0.96;
  if (leaf.toLowerCase() === hNorm) return 0.95;

  if (isWeakPrefixLabel(obj.label, h)) {
    return 0.12;
  }
  if (isWeakPrefixLabel(leaf, h)) {
    return 0.15;
  }

  const corpus = `${obj.label} ${obj.path.replace(/\//g, " ")} ${obj.selector}`;
  let score = scoreStepAgainstText(h, corpus);
  const segments = obj.path.split("/");
  for (const seg of segments) {
    const segLower = seg.toLowerCase();
    if (seg.length <= 2) continue;
    if (segLower === hNorm || locatorKeyCompact(seg) === hCompact) {
      score = Math.max(score, 0.9);
      continue;
    }
    if (isWeakPrefixLabel(seg, h)) continue;
    if (hNorm.includes(segLower)) {
      score = Math.max(score, 0.55);
    }
  }
  return score;
}

export function matchTestObjectsForStep(
  step: string,
  objects: ParsedTestObject[],
  minScore: number
): SemanticMatchResult<ParsedTestObject>[] {
  const out: SemanticMatchResult<ParsedTestObject>[] = [];
  for (const obj of objects) {
    const score = scoreObjectAgainstHint(step, obj);
    if (score >= minScore) {
      out.push({ item: obj, score, reason: `OR match ${obj.path}` });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

/** Match using the locator name from a click/type step (not the full step line). */
export function matchTestObjectByLocatorHint(
  hint: string,
  objects: ParsedTestObject[],
  minScore: number
): SemanticMatchResult<ParsedTestObject>[] {
  const exact = findTestObjectExactMatch(hint, objects);
  if (exact) {
    return [{ item: exact, score: 1, reason: `exact OR hint match ${exact.path}` }];
  }
  const out: SemanticMatchResult<ParsedTestObject>[] = [];
  for (const obj of objects) {
    const score = scoreObjectAgainstHint(hint, obj);
    if (score >= minScore) {
      out.push({ item: obj, score, reason: `OR hint match ${obj.path}` });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

function scoreKeywordRef(
  ref: string,
  kw: ParsedKeywordClass,
  method: ParsedKeywordMethod
): number {
  const r = ref.trim().toLowerCase();
  const full = `${kw.customKeywordsPath}.${method.name}`.toLowerCase();
  const short = `${kw.className}.${method.name}`.toLowerCase();
  if (r === full || r === short) return 1;
  if (full.endsWith(`.${r}`) || r.endsWith(`.${method.name.toLowerCase()}`)) return 0.92;
  const corpus = `${kw.className} ${method.name} ${method.semanticSummary} ${method.docComment ?? ""}`;
  return scoreStepAgainstText(ref, corpus);
}

export function matchKeywordsForStep(
  step: string,
  keywords: ParsedKeywordClass[],
  minScore: number
): SemanticMatchResult<{ kw: ParsedKeywordClass; method: ParsedKeywordMethod }>[] {
  const out: SemanticMatchResult<{ kw: ParsedKeywordClass; method: ParsedKeywordMethod }>[] = [];
  for (const kw of keywords) {
    for (const method of kw.methods) {
      const score = scoreKeywordRef(step, kw, method);
      if (score >= minScore) {
        out.push({
          item: { kw, method },
          score,
          reason: `Keyword ${kw.customKeywordsPath}.${method.name}`,
        });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 5);
}

export function matchKeywordByRef(
  ref: string,
  keywords: ParsedKeywordClass[],
  minScore: number
): SemanticMatchResult<{ kw: ParsedKeywordClass; method: ParsedKeywordMethod }>[] {
  return matchKeywordsForStep(ref, keywords, minScore);
}

export function matchTestScriptsForStep(
  step: string,
  scripts: ParsedTestScript[],
  minScore: number
): SemanticMatchResult<ParsedTestScript>[] {
  const out: SemanticMatchResult<ParsedTestScript>[] = [];
  for (const script of scripts) {
    const corpus = [
      script.logicalPath,
      script.displayName,
      script.semanticSummary,
      ...script.stepComments,
      ...script.findTestObjectRefs,
      ...script.customKeywordRefs,
      ...script.webUiCalls,
    ].join(" ");
    let score = scoreStepAgainstText(step, corpus);
    const leaf = script.displayName.replace(/_/g, " ");
    if (leaf.length > 3 && step.toLowerCase().includes(leaf.toLowerCase())) {
      score = Math.max(score, 0.7);
    }
    if (score >= minScore) {
      out.push({ item: script, score, reason: `Script ${script.logicalPath}` });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

/** Pluggable embedding hook — returns null until configured. */
export async function scoreWithEmbeddings(
  _step: string,
  _candidates: string[]
): Promise<number[] | null> {
  if (process.env.OLLAMA_EMBEDDINGS_URL?.trim() || process.env.GEMINI_API_KEY?.trim()) {
    // Future: call provider; today return null to use local matcher.
  }
  return null;
}
