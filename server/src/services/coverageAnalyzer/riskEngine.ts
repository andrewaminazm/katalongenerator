import type { RiskLevel } from "./types.js";

export function scoreToRiskLevel(score: number): RiskLevel {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "medium";
  return "low";
}

export function computeModuleScores(input: {
  module: string;
  scriptCount: number;
  weakAssertionCount: number;
  missingCount: number;
  avgAssertionRatio: number;
}): { coverageScore: number; riskLevel: RiskLevel; assertionScore: number } {
  const base = input.scriptCount > 0 ? 55 + Math.min(35, input.scriptCount * 4) : 15;
  const assertionScore = Math.round(input.avgAssertionRatio * 100);
  const penalty =
    input.weakAssertionCount * 12 + input.missingCount * 8 + (assertionScore < 20 ? 15 : 0);
  const coverageScore = Math.max(0, Math.min(100, base - penalty + assertionScore * 0.2));
  const risk = 100 - coverageScore + input.missingCount * 5;
  return {
    coverageScore: Math.round(coverageScore),
    riskLevel: scoreToRiskLevel(risk),
    assertionScore,
  };
}

export function computeOverallCoverage(modules: { coverageScore: number }[]): number {
  if (!modules.length) return 0;
  const sum = modules.reduce((a, m) => a + m.coverageScore, 0);
  return Math.round(sum / modules.length);
}
