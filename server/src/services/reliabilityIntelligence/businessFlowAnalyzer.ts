import type { FailureAnalysisResult } from "../failureAnalysis/types.js";
import type { BusinessFlowRiskSummary, RiskLevel } from "./types.js";
import { loadProjectIndex } from "../projectIntelligence/index.js";
import { listReliabilityMemory } from "./reliabilityMemory.js";

const FLOW_KEYWORDS: Record<string, RegExp> = {
  Checkout: /checkout|cart|payment|order/i,
  Authentication: /login|sign.?in|auth|token/i,
  Onboarding: /onboard|register|signup/i,
  Payment: /payment|billing|stripe/i,
  "Order processing": /order|fulfillment|shipping/i,
};

export async function analyzeBusinessFlowRisk(
  failure: FailureAnalysisResult,
  corpus: string,
  projectId?: string
): Promise<BusinessFlowRiskSummary | undefined> {
  let flowName = "General automation";
  for (const [name, re] of Object.entries(FLOW_KEYWORDS)) {
    if (re.test(corpus) || re.test(failure.rootCauseSummary)) {
      flowName = name;
      break;
    }
  }

  const index = projectId ? await loadProjectIndex(projectId) : null;
  const projectFlow = index?.reusableFlows?.find((f) =>
    f.name.toLowerCase().includes(flowName.toLowerCase().split(" ")[0] ?? "")
  );

  const history = await listReliabilityMemory(projectId, 50);
  const flowFailures = history.filter((h) => new RegExp(flowName.split(" ")[0]!, "i").test(h.rootCauseSummary));

  let stabilityScore = Math.round(100 - failure.flakyProbability * 100 - flowFailures.length * 4);
  stabilityScore = Math.max(10, Math.min(95, stabilityScore));

  let riskLevel: RiskLevel = "LOW";
  if (stabilityScore < 40 || failure.severity === "critical") riskLevel = "CRITICAL";
  else if (stabilityScore < 55) riskLevel = "HIGH";
  else if (stabilityScore < 70) riskLevel = "MEDIUM";

  const flakyTrend: BusinessFlowRiskSummary["flakyTrend"] =
    flowFailures.length >= 3 ? "degrading" : flowFailures.length === 0 ? "stable" : "unknown";

  const notes: string[] = [];
  if (projectFlow) notes.push(`Indexed flow: ${projectFlow.name} (${projectFlow.stepPattern.length} steps)`);
  if (flowFailures.length > 0) notes.push(`${flowFailures.length} similar failures in reliability memory`);

  return {
    flowName,
    stabilityScore,
    riskLevel,
    flakyTrend,
    notes,
  };
}
