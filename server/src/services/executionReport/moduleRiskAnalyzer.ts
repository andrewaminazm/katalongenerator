import type { FailureSeverity, FailureType, ModuleRiskRow } from "./types.js";
import { SEVERITY_WEIGHT } from "./severityEngine.js";

export function analyzeModuleRisk(
  tests: Array<{
    module: string;
    failureSeverity: FailureSeverity;
    failureType: FailureType;
  }>
): ModuleRiskRow[] {
  const map = new Map<
    string,
    { count: number; risk: number; types: Map<string, number>; maxSev: FailureSeverity }
  >();

  const sevRank: Record<FailureSeverity, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  for (const t of tests) {
    const mod = t.module?.trim() || "Unassigned";
    const cur = map.get(mod) ?? {
      count: 0,
      risk: 0,
      types: new Map(),
      maxSev: "LOW" as FailureSeverity,
    };
    cur.count += 1;
    cur.risk += SEVERITY_WEIGHT[t.failureSeverity];
    cur.types.set(t.failureType, (cur.types.get(t.failureType) ?? 0) + 1);
    if (sevRank[t.failureSeverity] > sevRank[cur.maxSev]) cur.maxSev = t.failureSeverity;
    map.set(mod, cur);
  }

  return [...map.entries()]
    .map(([module, v]) => {
      const dominant = [...v.types.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "UNKNOWN";
      const riskScore = Math.min(99, Math.round(v.risk * 8 + v.count * 3));
      return {
        module,
        failureCount: v.count,
        riskScore,
        stabilityScore: Math.max(5, 100 - riskScore),
        dominantFailureType: dominant,
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}
