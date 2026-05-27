import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";
import { findDuplicateSelectors, scoreOrObject } from "../projectIntelligenceV2/orAnalyzer.js";
import type { CoverageRecommendation, UnusedAssetFinding } from "./types.js";

export function analyzeOrCoverage(
  index: ProjectIndex,
  graph: ProjectGraphV2
): {
  unused: UnusedAssetFinding[];
  recommendations: CoverageRecommendation[];
  healthScore: number;
} {
  const unused: UnusedAssetFinding[] = graph.orphans.testObjects.map((id) => ({
    kind: "test_object",
    path: id.replace(/^or:/, ""),
    reason: "Not referenced by any indexed test script",
  }));

  const weakLocators = index.testObjects.filter((o) => scoreOrObject(o).stabilityScore < 45);
  const duplicates = findDuplicateSelectors(index.testObjects);

  const recommendations: CoverageRecommendation[] = [];

  if (unused.length > 0) {
    recommendations.push({
      id: "or-unused",
      severity: unused.length > 20 ? "high" : "medium",
      category: "or",
      title: `${unused.length} unused Object Repository item(s)`,
      detail: "Remove or wire orphans into tests to reduce maintenance noise.",
      affectedItems: unused.slice(0, 15).map((u) => u.path),
    });
  }

  if (duplicates.length > 0) {
    recommendations.push({
      id: "or-duplicates",
      severity: "medium",
      category: "or",
      title: `${duplicates.length} duplicate selector group(s)`,
      detail: "Consolidate duplicate OR entries to a single canonical object per element.",
      affectedItems: duplicates.slice(0, 5).map((d) => d.selector.slice(0, 80)),
    });
  }

  if (weakLocators.length > 0) {
    recommendations.push({
      id: "or-weak-locators",
      severity: "high",
      category: "or",
      title: `${weakLocators.length} low-stability locator(s)`,
      detail: "Prioritize healing XPath/CSS with shorter paths or data-testid strategy.",
      affectedItems: weakLocators.slice(0, 10).map((o) => o.path),
    });
  }

  const used = index.testObjects.length - unused.length;
  const healthScore =
    index.testObjects.length === 0
      ? 100
      : Math.round(
          (used / index.testObjects.length) * 50 +
            (1 - Math.min(1, duplicates.length / 10)) * 25 +
            (1 - Math.min(1, weakLocators.length / 20)) * 25
        );

  return { unused, recommendations, healthScore };
}
