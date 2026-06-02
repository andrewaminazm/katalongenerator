import type { BusinessFlowRow } from "./types.js";
import type { FailureSeverity } from "./types.js";

const FLOWS: Array<{ name: string; pattern: RegExp }> = [
  { name: "Authentication", pattern: /login|auth|sign.?in|sso/i },
  { name: "Registration", pattern: /register|signup|onboard/i },
  { name: "Checkout", pattern: /checkout|cart|basket/i },
  { name: "Payment", pattern: /payment|billing|stripe|card/i },
  { name: "API flows", pattern: /api|rest|graphql|ws/i },
  { name: "Order processing", pattern: /order|fulfillment|shipping/i },
];

export function analyzeBusinessFlowImpact(
  exec: { totalTestCases: number; passed: number; failed: number },
  tests: Array<{ bugName: string; module: string; failureSeverity: FailureSeverity }>
): BusinessFlowRow[] {
  const passBase = exec.totalTestCases > 0 ? (exec.passed / exec.totalTestCases) * 100 : 100;

  return FLOWS.map((flow) => {
    const related = tests.filter(
      (t) => flow.pattern.test(t.bugName) || flow.pattern.test(t.module)
    );
    const failCount = related.length;
    const riskScore = Math.min(
      99,
      related.reduce((s, t) => s + (t.failureSeverity === "CRITICAL" ? 25 : t.failureSeverity === "HIGH" ? 15 : 8), 0)
    );
    const passRatePercent =
      failCount === 0
        ? Math.round(passBase)
        : Math.max(0, Math.round(passBase - failCount * 8));

    return {
      flowName: flow.name,
      passRatePercent,
      riskScore,
      failedTests: related.map((t) => t.bugName).slice(0, 8),
      impact:
        failCount === 0
          ? "No failures mapped to this flow in this run."
          : `${failCount} failure(s) — ${related.some((t) => t.failureSeverity === "CRITICAL") ? "release impact likely" : "monitor before release"}`,
    };
  }).filter((f) => f.failedTests.length > 0 || /Authentication|Payment|Checkout/.test(f.flowName));
}
