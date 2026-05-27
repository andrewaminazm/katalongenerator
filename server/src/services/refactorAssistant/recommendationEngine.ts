import type { RefactorIssue, RefactorRecommendation } from "./types.js";

export function buildRecommendations(issues: RefactorIssue[]): RefactorRecommendation[] {
  return issues
    .map((issue) => ({
      ...issue,
      estimatedImpact:
        issue.impactScore >= 75
          ? "High — reduces flaky failures and maintenance cost"
          : issue.impactScore >= 50
            ? "Medium — improves clarity and reuse"
            : "Low — incremental hygiene",
      priority: issue.impactScore + (issue.severity === "critical" ? 20 : issue.severity === "high" ? 10 : 0),
    }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 40);
}

export function computeMaintainabilityScore(scores: {
  duplicationScore: number;
  assertionQualityScore: number;
  orHealthScore: number;
  waitStabilityScore: number;
  modularityScore: number;
  complexityScore: number;
}): number {
  const avg =
    (scores.duplicationScore +
      scores.assertionQualityScore +
      scores.orHealthScore +
      scores.waitStabilityScore +
      scores.modularityScore +
      scores.complexityScore) /
    6;
  return Math.round(avg);
}

export function computeFrameworkHealthScore(
  maintainability: number,
  issueCount: number
): number {
  return Math.max(0, Math.min(100, maintainability - Math.min(30, issueCount)));
}
