import type { FailedTestInput, FailureSeverity, FailureType } from "./types.js";

export const SEVERITY_WEIGHT: Record<FailureSeverity, number> = {
  CRITICAL: 5,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export function normalizeSeverity(raw?: string): FailureSeverity {
  const s = String(raw ?? "").toUpperCase();
  if (s === "CRITICAL") return "CRITICAL";
  if (s === "HIGH") return "HIGH";
  if (s === "MEDIUM") return "MEDIUM";
  return "LOW";
}

export function inferSeverity(test: FailedTestInput): FailureSeverity {
  if (test.failureSeverity) return normalizeSeverity(test.failureSeverity);

  const msg = `${test.errorMessage} ${test.module} ${test.testCaseName}`.toLowerCase();
  if (/payment|checkout|auth|login|security|production|blocker/.test(msg)) return "CRITICAL";
  if (/timeout|not found|element|api 5|500|assertion failed/.test(msg)) return "HIGH";
  if (/flaky|intermittent|stale|retry/.test(msg)) return "MEDIUM";
  return "LOW";
}

export function inferFailureType(test: FailedTestInput): FailureType {
  const raw = String(test.failureType ?? "").toUpperCase();
  if (raw === "UI" || raw === "API" || raw === "ASSERTION" || raw === "TIMEOUT" || raw === "DATA") {
    return raw as FailureType;
  }
  const msg = test.errorMessage.toLowerCase();
  if (/api|status|401|403|404|500|rest|json/.test(msg)) return "API";
  if (/assert|verify|expected/.test(msg)) return "ASSERTION";
  if (/timeout|timed out|wait/.test(msg)) return "TIMEOUT";
  if (/data|null|invalid input|csv/.test(msg)) return "DATA";
  if (/element|locator|click|xpath|selector|stale/.test(msg)) return "UI";
  return "UNKNOWN";
}

export function enrichFailedTests(tests: FailedTestInput[]): Array<
  FailedTestInput & { failureSeverity: FailureSeverity; failureType: FailureType }
> {
  return tests.map((t) => ({
    ...t,
    failureSeverity: inferSeverity(t),
    failureType: inferFailureType(t),
  }));
}

export function countBySeverity(
  tests: Array<{ failureSeverity: FailureSeverity }>
): Record<FailureSeverity, number> {
  return {
    CRITICAL: tests.filter((t) => t.failureSeverity === "CRITICAL").length,
    HIGH: tests.filter((t) => t.failureSeverity === "HIGH").length,
    MEDIUM: tests.filter((t) => t.failureSeverity === "MEDIUM").length,
    LOW: tests.filter((t) => t.failureSeverity === "LOW").length,
  };
}

export function weightedRiskPoints(tests: Array<{ failureSeverity: FailureSeverity }>): number {
  return tests.reduce((sum, t) => sum + SEVERITY_WEIGHT[t.failureSeverity], 0);
}
