import type { FailureSeverity, ReleaseStatus, TestExecutionInput } from "./types.js";
import { SEVERITY_WEIGHT, countBySeverity, weightedRiskPoints } from "./severityEngine.js";
import type { FailedTestInput } from "./types.js";

export function passRatePercent(exec: TestExecutionInput): number {
  if (exec.totalTestCases <= 0) return 0;
  return Math.round((exec.passed / exec.totalTestCases) * 1000) / 10;
}

export function computeStabilityScore(
  exec: TestExecutionInput,
  severityCounts: Record<FailureSeverity, number>
): number {
  const pass = passRatePercent(exec);
  const penalty =
    severityCounts.CRITICAL * 12 +
    severityCounts.HIGH * 6 +
    severityCounts.MEDIUM * 3 +
    severityCounts.LOW * 1;
  return Math.max(5, Math.min(98, Math.round(pass - penalty * 0.4)));
}

export function computeRiskScore(
  exec: TestExecutionInput,
  enrichedFailures: Array<{ failureSeverity: FailureSeverity; module: string }>
): number {
  const base = weightedRiskPoints(enrichedFailures);
  const failRatio = exec.totalTestCases > 0 ? exec.failed / exec.totalTestCases : 0;
  return Math.min(99, Math.round(base * 4 + failRatio * 40));
}

export function computeReleaseReadiness(
  exec: TestExecutionInput,
  severityCounts: Record<FailureSeverity, number>,
  criticalPathFailures: number
): {
  score: number;
  status: ReleaseStatus;
  confidencePercent: number;
  blockingIssues: string[];
  factors: string[];
} {
  const pass = passRatePercent(exec);
  const blockingIssues: string[] = [];
  const factors: string[] = [];

  let score = pass;
  score -= severityCounts.CRITICAL * 15;
  score -= severityCounts.HIGH * 8;
  score -= severityCounts.MEDIUM * 3;
  score -= criticalPathFailures * 10;
  score = Math.max(0, Math.min(100, Math.round(score)));

  if (severityCounts.CRITICAL > 0) {
    blockingIssues.push(`${severityCounts.CRITICAL} CRITICAL failure(s) — release blocker`);
  }
  if (criticalPathFailures > 0 && severityCounts.CRITICAL + severityCounts.HIGH > 0) {
    blockingIssues.push("Critical-path flows (auth/payment/checkout) affected");
  }
  if (pass < 70) blockingIssues.push(`Pass rate ${pass}% below minimum threshold (70%)`);

  let status: ReleaseStatus = "READY";
  if (blockingIssues.length > 0 || score < 55) status = "BLOCKED";
  else if (score < 80 || severityCounts.HIGH > 2) status = "AT_RISK";

  factors.push(`Pass rate ${pass}%`);
  factors.push(
    `Severity weight: CRITICAL=${severityCounts.CRITICAL}×${SEVERITY_WEIGHT.CRITICAL}, HIGH=${severityCounts.HIGH}×${SEVERITY_WEIGHT.HIGH}`
  );
  if (exec.failed > 0) factors.push(`${exec.failed} failed of ${exec.totalTestCases} tests`);

  const confidencePercent = Math.min(
    98,
    Math.round(60 + pass * 0.35 - severityCounts.CRITICAL * 10)
  );

  return { score, status, confidencePercent, blockingIssues, factors };
}

export function countCriticalPathFailures(
  tests: Array<{ module: string; testCaseName: string; failureSeverity: FailureSeverity }>
): number {
  const criticalRe = /payment|checkout|auth|login|order|billing/i;
  return tests.filter(
    (t) =>
      t.failureSeverity === "CRITICAL" ||
      t.failureSeverity === "HIGH" ||
      criticalRe.test(t.module) ||
      criticalRe.test(t.testCaseName)
  ).length;
}
