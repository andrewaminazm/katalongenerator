import type { FailureAnalysisResult } from "../failureAnalysis/types.js";
import type { StabilityTimelinePoint } from "./types.js";
import { listReliabilityMemory } from "./reliabilityMemory.js";

export async function buildStabilityTimeline(
  failure: FailureAnalysisResult,
  projectId?: string
): Promise<StabilityTimelinePoint[]> {
  const points: StabilityTimelinePoint[] = [];
  const history = await listReliabilityMemory(projectId, 30);

  for (const h of history.slice(0, 8)) {
    points.push({
      date: h.analyzedAt.slice(0, 10),
      event: `${h.failureType}: ${h.rootCauseSummary.slice(0, 50)}`,
      impact: h.flakyProbability > 0.6 ? "high" : h.flakyProbability > 0.35 ? "medium" : "low",
    });
  }

  points.unshift({
    date: failure.analyzedAt.slice(0, 10),
    event: `Current failure: ${failure.rootCauseSummary.slice(0, 55)}`,
    impact: failure.severity === "critical" ? "high" : failure.severity === "high" ? "medium" : "low",
  });

  if (failure.relatedPatterns.length > 0) {
    const p = failure.relatedPatterns[0]!;
    points.push({
      date: p.lastSeen.slice(0, 10),
      event: `Pattern recurring (${p.occurrences}×): ${p.signature.slice(0, 45)}`,
      impact: (p.flakyRate ?? 0) > 0.5 ? "high" : "medium",
    });
  }

  return points.slice(0, 12);
}
