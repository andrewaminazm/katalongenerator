import {
  computeFrameworkHealthScore,
  computeMaintainabilityScore,
} from "../refactorAssistant/recommendationEngine.js";
import type { FrameworkHealthScores } from "./types.js";

export function buildFrameworkHealth(input: {
  duplicationScore: number;
  assertionQualityScore: number;
  orHealthScore: number;
  waitStabilityScore: number;
  modularityScore: number;
  complexityScore: number;
  flakinessScore: number;
  issueCount: number;
}): FrameworkHealthScores {
  const maintainabilityScore = computeMaintainabilityScore({
    duplicationScore: input.duplicationScore,
    assertionQualityScore: input.assertionQualityScore,
    orHealthScore: input.orHealthScore,
    waitStabilityScore: input.waitStabilityScore,
    modularityScore: input.modularityScore,
    complexityScore: input.complexityScore,
  });

  const overallHealthScore = computeFrameworkHealthScore(
    maintainabilityScore,
    input.issueCount
  );

  return {
    maintainabilityScore,
    locatorQualityScore: input.orHealthScore,
    assertionQualityScore: input.assertionQualityScore,
    architectureQualityScore: input.modularityScore,
    flakinessScore: input.flakinessScore,
    duplicationScore: input.duplicationScore,
    scalabilityScore: Math.round((input.modularityScore + input.duplicationScore) / 2),
    overallHealthScore,
  };
}
