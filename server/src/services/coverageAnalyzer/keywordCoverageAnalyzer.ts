import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";
import type { CoverageRecommendation, UnusedAssetFinding } from "./types.js";

export function analyzeKeywordCoverage(
  index: ProjectIndex,
  graph: ProjectGraphV2
): { unused: UnusedAssetFinding[]; recommendations: CoverageRecommendation[]; score: number } {
  const unused: UnusedAssetFinding[] = graph.orphans.keywords.map((id) => ({
    kind: "keyword",
    path: id.replace(/^kw:/, ""),
    reason: "Not called from any indexed test script",
  }));

  const largeClasses = index.keywords.filter((k) => k.methods.length > 25);
  const recommendations: CoverageRecommendation[] = [];

  if (unused.length > 0) {
    recommendations.push({
      id: "kw-unused",
      severity: unused.length > 15 ? "medium" : "info",
      category: "keyword",
      title: `${unused.length} unused custom keyword class(es)`,
      detail: "Archive dead keywords or expose them via shared flows to improve reuse.",
      affectedItems: unused.slice(0, 12).map((u) => u.path),
    });
  }

  for (const k of largeClasses.slice(0, 5)) {
    recommendations.push({
      id: `kw-large-${k.className}`,
      severity: "medium",
      category: "architecture",
      title: `Large keyword class: ${k.className} (${k.methods.length} methods)`,
      detail: "Split into focused helpers (login, navigation, data) for maintainability.",
      affectedItems: [k.customKeywordsPath],
    });
  }

  const used = index.keywords.length - unused.length;
  const score =
    index.keywords.length === 0
      ? 100
      : Math.round((used / index.keywords.length) * 100);

  return { unused, recommendations, score };
}
