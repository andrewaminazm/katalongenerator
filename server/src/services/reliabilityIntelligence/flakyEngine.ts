import type { FailureAnalysisResult } from "../failureAnalysis/types.js";
import { listReliabilityMemory } from "./reliabilityMemory.js";

export async function analyzeProjectFlakiness(projectId: string): Promise<
  Array<{ module: string; flakyScore: number; failureCount: number; reasons: string[] }>
> {
  const history = await listReliabilityMemory(projectId, 150);
  const byModule = new Map<string, { sum: number; count: number }>();

  for (const h of history) {
    const mod = h.module ?? h.failureType;
    const cur = byModule.get(mod) ?? { sum: 0, count: 0 };
    cur.sum += h.flakyProbability;
    cur.count += 1;
    byModule.set(mod, cur);
  }

  return [...byModule.entries()]
    .map(([module, v]) => ({
      module,
      flakyScore: Math.round((v.sum / v.count) * 100),
      failureCount: v.count,
      reasons: [
        v.count >= 3 ? "Recurring failures in memory" : "Limited history",
        v.sum / v.count > 0.5 ? "High average flaky probability" : "Moderate instability",
      ],
    }))
    .sort((a, b) => b.flakyScore - a.flakyScore)
    .slice(0, 15);
}

export function enhanceFlakyFromHistory(
  failure: FailureAnalysisResult,
  historyFlakyAvg: number
): number {
  if (historyFlakyAvg <= 0) return failure.flakyProbability;
  return Math.min(1, failure.flakyProbability * 0.7 + historyFlakyAvg * 0.3);
}
