import { scoreOrObject } from "../projectIntelligenceV2/orAnalyzer.js";
import { loadProjectIndex } from "../projectIntelligence/index.js";
import type { FailureAnalysisResult } from "../failureAnalysis/types.js";
import type { LocatorHealthEntry } from "./types.js";
import { listReliabilityMemory } from "./reliabilityMemory.js";

export async function analyzeLocatorHealth(
  failure: FailureAnalysisResult,
  corpus: string,
  projectId?: string
): Promise<LocatorHealthEntry | undefined> {
  const orPath =
    failure.projectContext?.matchedOrPath ??
    failure.executionLogInsights?.failedTestObject ??
    extractOrFromCorpus(corpus);
  if (!orPath && failure.failureType !== "LOCATOR") return undefined;

  const label = orPath?.split("/").pop() ?? "unknown element";
  const history = await listReliabilityMemory(projectId, 80);
  const failureCount = history.filter(
    (h) => h.orPath === orPath || corpus.includes(h.orPath ?? "___")
  ).length;
  const healCount = history.filter((h) => h.repairSucceeded && h.orPath === orPath).length;

  let stabilityScore = 50;
  let reasons: string[] = [];
  const recommendations: string[] = [];

  if (failure.locatorInsights) {
    reasons.push(failure.locatorInsights.problem);
    if (failure.locatorInsights.isDynamic) reasons.push("Dynamic id or index-based XPath");
    if (failure.locatorInsights.domChangeLikely) reasons.push("DOM changes after locate");
    recommendations.push(failure.locatorInsights.recommendation);
  }

  if (projectId && orPath) {
    const index = await loadProjectIndex(projectId);
    const obj = index?.testObjects.find((o) => o.path === orPath || o.label === label);
    if (obj) {
      const q = scoreOrObject(obj);
      stabilityScore = q.stabilityScore;
      reasons = [...reasons, ...q.issues.slice(0, 4)];
      if (q.stabilityScore < 50) {
        recommendations.push("Prefer data-testid or accessibility role over long XPath");
        recommendations.push("Consider OR redesign with Page Object wrapper");
      }
    }
  }

  if (failureCount >= 3) reasons.push(`Failed ${failureCount} times in reliability memory`);
  if (healCount >= 2) reasons.push(`Locator healed ${healCount} times — underlying instability`);

  const healthScore = Math.max(
    5,
    Math.min(
      99,
      Math.round(stabilityScore * 0.6 + (100 - failure.flakyProbability * 100) * 0.2 - failureCount * 5)
    )
  );

  recommendations.push("data-testid", "aria-label", "stable CSS selector");

  return {
    orPath: orPath ?? label,
    label,
    healthScore,
    stabilityScore,
    failureCount,
    healCount,
    reasons: [...new Set(reasons)].slice(0, 6),
    recommendations: [...new Set(recommendations)].slice(0, 5),
  };
}

function extractOrFromCorpus(corpus: string): string | undefined {
  const m = corpus.match(/Object Repository[/']([^'"]+)/i) ?? corpus.match(/findTestObject\(['"]([^'"]+)['"]\)/i);
  return m?.[1];
}
