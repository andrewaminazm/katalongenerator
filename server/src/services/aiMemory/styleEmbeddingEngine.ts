import type { StyleEmbeddingFingerprint } from "./types.js";
import type { ParsedTestScript } from "../projectIntelligence/types.js";

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "in",
  "on",
  "for",
  "def",
  "import",
  "as",
  "new",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_.'/]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function buildStyleEmbedding(testScripts: ParsedTestScript[]): StyleEmbeddingFingerprint {
  const terms: Record<string, number> = {};

  for (const script of testScripts) {
    const blob = [
      script.logicalPath,
      script.semanticSummary,
      ...script.customKeywordRefs,
      ...script.findTestObjectRefs,
      ...script.webUiCalls.slice(0, 40),
    ].join(" ");

    for (const t of tokenize(blob)) {
      terms[t] = (terms[t] ?? 0) + 1;
    }
  }

  const max = Math.max(1, ...Object.values(terms));
  for (const k of Object.keys(terms)) {
    terms[k] = terms[k]! / max;
  }

  return { terms, scriptCount: testScripts.length };
}

export function cosineSimilarity(
  a: Record<string, number>,
  b: Record<string, number>
): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function embedQueryFromSteps(steps: string[]): Record<string, number> {
  const terms: Record<string, number> = {};
  const blob = steps.join(" ");
  for (const t of tokenize(blob)) {
    terms[t] = (terms[t] ?? 0) + 1;
  }
  const max = Math.max(1, ...Object.values(terms));
  for (const k of Object.keys(terms)) {
    terms[k] = terms[k]! / max;
  }
  return terms;
}
