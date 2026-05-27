import type { FailureType, FlakyInsights, RootCauseInsight } from "./types.js";
import type { FailureSeverity } from "./types.js";

export function buildFlakyInsights(
  tests: Array<{ testCaseName: string; errorMessage: string; failureSeverity: FailureSeverity }>
): FlakyInsights {
  const repeated = new Map<string, number>();
  for (const t of tests) {
    const key = t.testCaseName.toLowerCase();
    repeated.set(key, (repeated.get(key) ?? 0) + 1);
  }

  const repeatedFailureSignals = [...repeated.entries()]
    .filter(([, c]) => c >= 2)
    .map(([name, c]) => `${name} appears ${c} times in failure list`);

  const flakyCandidates = tests
    .filter(
      (t) =>
        t.failureSeverity === "LOW" ||
        t.failureSeverity === "MEDIUM" ||
        /flaky|stale|intermittent|timeout/i.test(t.errorMessage)
    )
    .map((t) => t.testCaseName)
    .slice(0, 10);

  const regressionSignals: string[] = [];
  if (tests.length >= 5) regressionSignals.push("Failure volume suggests regression in latest build");
  if (tests.some((t) => /payment|checkout/i.test(t.testCaseName))) {
    regressionSignals.push("Commerce path failures — compare with previous green build");
  }

  return {
    repeatedFailureSignals,
    flakyCandidates: [...new Set(flakyCandidates)],
    stabilityTrend: tests.length >= 8 ? "degrading" : tests.length >= 3 ? "unknown" : "stable",
    regressionSignals,
  };
}

export function buildRootCauseInsights(
  tests: Array<{ failureType: FailureType; errorMessage: string; module: string }>
): RootCauseInsight[] {
  const byType = new Map<FailureType, number>();
  for (const t of tests) byType.set(t.failureType, (byType.get(t.failureType) ?? 0) + 1);

  const insights: RootCauseInsight[] = [];

  const ui = byType.get("UI") ?? 0;
  if (ui > 0) {
    insights.push({
      category: "UI instability",
      likelihood: ui >= tests.length * 0.4 ? "high" : "medium",
      summary: `${ui} UI/locator-related failures — review OR strategy, waits, and dynamic DOM.`,
    });
  }

  const api = byType.get("API") ?? 0;
  if (api > 0) {
    insights.push({
      category: "API instability",
      likelihood: api >= 2 ? "high" : "medium",
      summary: `${api} API failures — validate auth tokens, contracts, and environment availability.`,
    });
  }

  const timing = (byType.get("TIMEOUT") ?? 0) + (byType.get("ASSERTION") ?? 0);
  if (timing > 0) {
    insights.push({
      category: "Timing & assertions",
      likelihood: "medium",
      summary: "Synchronization or assertion timing — add explicit waits before verify steps.",
    });
  }

  if (tests.some((t) => /environment|503|connection/i.test(t.errorMessage))) {
    insights.push({
      category: "Environment",
      likelihood: "medium",
      summary: "Environment or infrastructure signals detected — confirm QA/staging health before code fixes.",
    });
  }

  if (insights.length === 0) {
    insights.push({
      category: "General",
      likelihood: "low",
      summary: "Insufficient failure diversity for strong root-cause clustering — review top modules manually.",
    });
  }

  return insights;
}

export function buildRecommendations(
  releaseStatus: string,
  modules: Array<{ module: string; riskScore: number }>,
  flaky: FlakyInsights,
  severityCritical: number
): string[] {
  const recs: string[] = [];

  if (severityCritical > 0) {
    recs.push("P0: Resolve all CRITICAL failures before any production promotion.");
  }
  if (releaseStatus === "BLOCKED") {
    recs.push("Hold release — execute targeted regression on failed modules after fixes.");
  }
  if (modules[0]) {
    recs.push(`Focus stabilization on module "${modules[0].module}" (highest risk score).`);
  }
  if (flaky.flakyCandidates.length > 0) {
    recs.push(`Quarantine or mark flaky: ${flaky.flakyCandidates.slice(0, 3).join(", ")}`);
  }
  recs.push("Re-run failed suites in isolation after locator/wait fixes.");
  recs.push("Integrate failure severity gates in CI (block on CRITICAL).");
  recs.push("Use AI Failure Analyzer for deep root-cause on top 5 failures.");

  return recs.slice(0, 10);
}
