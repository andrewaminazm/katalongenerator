import type { FailureAnalysisResult } from "../failureAnalysis/types.js";
import type { EnvironmentInsightSummary } from "./types.js";

export function buildEnvironmentInsights(
  failure: FailureAnalysisResult,
  corpus: string
): EnvironmentInsightSummary {
  const c = corpus.toLowerCase();
  const signals: string[] = [];
  let environmentIssueLikely = failure.failureType === "ENVIRONMENT";

  if (/timeout|timed out|connection refused|econnrefused|503|502|504/.test(c)) {
    signals.push("Network or service timeout");
    environmentIssueLikely = true;
  }
  if (/chromedriver|geckodriver|session not created|browser version/.test(c)) {
    signals.push("Browser/driver mismatch");
    environmentIssueLikely = true;
  }
  if (/staging|qa\.|uat\.|slow response/.test(c)) {
    signals.push("Non-production environment slowness");
  }
  if (failure.apiInsights?.statusCode && failure.apiInsights.statusCode >= 500) {
    signals.push(`API ${failure.apiInsights.statusCode} — server-side instability`);
    environmentIssueLikely = true;
  }

  const falsePositiveRisk = environmentIssueLikely && failure.locatorInsights ? 0.35 : 0.1;

  return {
    environmentIssueLikely,
    signals: signals.length ? signals : ["No strong environment-only signals — likely test/automation issue"],
    falsePositiveRisk,
    recommendation: environmentIssueLikely
      ? "Verify environment health before changing locators. Re-run on stable QA after API/browser checks."
      : "Environment appears stable — focus on locator, wait, or assertion fixes.",
  };
}
