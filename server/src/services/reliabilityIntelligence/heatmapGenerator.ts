import { scoreOrObject } from "../projectIntelligenceV2/orAnalyzer.js";
import { loadProjectIndex } from "../projectIntelligence/index.js";
import type { HeatmapCell } from "./types.js";
import { listReliabilityMemory } from "./reliabilityMemory.js";

export async function buildProjectHeatmap(projectId: string): Promise<HeatmapCell[]> {
  const index = await loadProjectIndex(projectId);
  if (!index) return [];

  const history = await listReliabilityMemory(projectId, 100);
  const cells: HeatmapCell[] = [];

  const moduleCounts = new Map<string, number>();
  for (const h of history) {
    const mod = h.module ?? h.failureType;
    moduleCounts.set(mod, (moduleCounts.get(mod) ?? 0) + 1);
  }
  for (const [mod, count] of moduleCounts) {
    cells.push({
      id: `mod-${mod}`,
      label: mod,
      category: "module",
      riskScore: Math.min(99, count * 15 + 20),
      failureCount: count,
    });
  }

  for (const flow of (index.reusableFlows ?? []).slice(0, 8)) {
    const fails = history.filter((h) => h.rootCauseSummary.toLowerCase().includes(flow.name.toLowerCase())).length;
    cells.push({
      id: `flow-${flow.id}`,
      label: flow.name,
      category: "flow",
      riskScore: Math.min(99, 25 + fails * 12 + (100 - flow.confidence * 100) * 0.3),
      failureCount: fails,
    });
  }

  const weakOr = index.testObjects
    .map((o) => ({ o, score: scoreOrObject(o) }))
    .filter((x) => x.score.stabilityScore < 55)
    .slice(0, 10);

  for (const { o, score } of weakOr) {
    cells.push({
      id: `or-${o.path}`,
      label: o.label,
      category: "or",
      riskScore: Math.round(100 - score.stabilityScore),
      failureCount: history.filter((h) => h.orPath === o.path).length,
    });
  }

  const apiScripts = (index.testScripts ?? []).filter((s) => /\/API\//i.test(s.logicalPath));
  if (apiScripts.length > 0) {
    cells.push({
      id: "api-suite",
      label: "API tests",
      category: "api",
      riskScore: 35 + history.filter((h) => h.failureType === "API").length * 10,
      failureCount: history.filter((h) => h.failureType === "API").length,
    });
  }

  return cells.sort((a, b) => b.riskScore - a.riskScore).slice(0, 24);
}

export function heatmapSliceFromFailure(
  failure: import("../failureAnalysis/types.js").FailureAnalysisResult,
  locatorLabel?: string
): HeatmapCell[] {
  const cells: HeatmapCell[] = [
    {
      id: "current-failure",
      label: failure.failureType,
      category: "module",
      riskScore: Math.round(failure.flakyProbability * 100),
      failureCount: failure.relatedPatterns[0]?.occurrences ?? 1,
    },
  ];
  if (locatorLabel) {
    cells.push({
      id: "locator",
      label: locatorLabel,
      category: "or",
      riskScore: Math.round((1 - failure.rootCauseConfidence) * 100),
      failureCount: failure.relatedPatterns.length,
    });
  }
  return cells;
}
