import { scoreOrObject } from "../projectIntelligenceV2/orAnalyzer.js";
import { loadProjectIndex } from "../projectIntelligence/index.js";

export async function detectFrameworkWeaknesses(projectId: string): Promise<string[]> {
  const index = await loadProjectIndex(projectId);
  if (!index) return [];

  const weaknesses: string[] = [];
  const scripts = index.testScripts ?? index.testCases ?? [];

  const giantScripts = scripts.filter((s) => (s.lineCount ?? 0) > 200);
  if (giantScripts.length > 0) {
    weaknesses.push(`${giantScripts.length} scripts exceed 200 lines — split into keywords`);
  }

  const weakOr = index.testObjects.filter((o) => scoreOrObject(o).stabilityScore < 45);
  if (weakOr.length > 5) {
    weaknesses.push(`${weakOr.length} OR objects have weak locator stability`);
  }

  if (index.stats.keywords > 0 && index.stats.testScripts / Math.max(1, index.stats.keywords) > 15) {
    weaknesses.push("Low keyword reuse ratio — duplicated automation logic likely");
  }

  if (index.codingStyleHints.some((h) => /WebUI\.delay/i.test(h))) {
    weaknesses.push("Fixed delays detected — flaky timing risk");
  }

  const dupFlows = (index.reusableFlows ?? []).length;
  if (dupFlows === 0 && scripts.length > 20) {
    weaknesses.push("No reusable flows indexed — business flows may be duplicated across scripts");
  }

  return weaknesses.slice(0, 10);
}

export function weaknessesFromFailure(
  failure: import("../failureAnalysis/types.js").FailureAnalysisResult
): string[] {
  return failure.architectureInsights.slice(0, 5);
}
