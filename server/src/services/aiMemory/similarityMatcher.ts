import type { ProjectMemoryProfile } from "./types.js";
import type { ParsedTestScript } from "../projectIntelligence/types.js";
import {
  buildStyleEmbedding,
  cosineSimilarity,
  embedQueryFromSteps,
} from "./styleEmbeddingEngine.js";

export interface SimilarScriptHit {
  logicalPath: string;
  score: number;
  summary: string;
  keywordRefs: string[];
  orRefs: string[];
}

export function findSimilarScripts(
  steps: string[],
  testScripts: ParsedTestScript[],
  profile: ProjectMemoryProfile,
  limit = 5
): SimilarScriptHit[] {
  const queryVec = embedQueryFromSteps(steps);
  const hits: SimilarScriptHit[] = [];

  for (const script of testScripts) {
    const scriptEmbed = buildStyleEmbedding([script]);
    const score = cosineSimilarity(queryVec, scriptEmbed.terms);
    if (score < 0.05) continue;
    hits.push({
      logicalPath: script.logicalPath,
      score,
      summary: script.semanticSummary || script.displayName,
      keywordRefs: script.customKeywordRefs.slice(0, 8),
      orRefs: script.findTestObjectRefs.slice(0, 8),
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function findMatchingFlows(
  steps: string[],
  profile: ProjectMemoryProfile
): ProjectMemoryProfile["reusableFlows"] {
  const blob = steps.join(" ").toLowerCase();
  return profile.reusableFlows.filter((f) => {
    const name = f.name.toLowerCase();
    if (blob.includes(name.split(" ")[0]!)) return true;
    return f.stepPattern.some((p) => blob.includes(p.toLowerCase().slice(0, 12)));
  });
}
