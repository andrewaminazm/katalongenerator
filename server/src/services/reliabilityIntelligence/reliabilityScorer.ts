import type { FailureAnalysisResult } from "../failureAnalysis/types.js";
import type { RiskLevel } from "./types.js";

export function computeReliabilityScores(failure: FailureAnalysisResult): {
  reliabilityScore: number;
  repairSuccessPrediction: number;
  riskLevel: RiskLevel;
  confidenceExplanation: string[];
} {
  const flakyPct = Math.round(failure.flakyProbability * 100);
  const confPct = Math.round(failure.rootCauseConfidence * 100);
  const fixPct = Math.round(failure.suggestedFixConfidence * 100);

  let reliabilityScore = 100;
  reliabilityScore -= flakyPct * 0.4;
  reliabilityScore -= (100 - confPct) * 0.25;
  if (failure.severity === "critical") reliabilityScore -= 15;
  else if (failure.severity === "high") reliabilityScore -= 10;
  else if (failure.severity === "medium") reliabilityScore -= 5;
  if (failure.reproducibility === "intermittent") reliabilityScore -= 8;
  reliabilityScore = Math.max(5, Math.min(98, Math.round(reliabilityScore)));

  let repairSuccessPrediction = Math.round((confPct * 0.5 + fixPct * 0.5) * 0.95);
  if (failure.failureType === "ENVIRONMENT") repairSuccessPrediction -= 15;
  if (failure.healingSuggestions.length > 0) repairSuccessPrediction += 5;
  repairSuccessPrediction = Math.max(20, Math.min(95, repairSuccessPrediction));

  let riskLevel: RiskLevel = "LOW";
  const riskScore = flakyPct * 0.5 + (100 - reliabilityScore) * 0.5;
  if (riskScore >= 70 || failure.severity === "critical") riskLevel = "CRITICAL";
  else if (riskScore >= 50 || failure.severity === "high") riskLevel = "HIGH";
  else if (riskScore >= 30) riskLevel = "MEDIUM";

  const confidenceExplanation: string[] = [
    `Root cause confidence ${confPct}% from log/stacktrace/API/screenshot signal agreement.`,
    `Flaky probability ${flakyPct}% (${failure.flakyLevel} — ${failure.reproducibility}).`,
    `Suggested fix confidence ${fixPct}%.`,
  ];
  if (failure.relatedPatterns.length > 0) {
    confidenceExplanation.push(
      `Historical pattern: seen ${failure.relatedPatterns[0]!.occurrences} times in failure memory.`
    );
  }
  if (failure.aiEnhanced) {
    confidenceExplanation.push("AI reasoning layer applied on top of deterministic analyzers.");
  }

  return {
    reliabilityScore,
    repairSuccessPrediction,
    riskLevel,
    confidenceExplanation,
  };
}
