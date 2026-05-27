import { analyzeWaits } from "../refactorAssistant/waitAnalyzer.js";
import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RepairSuggestion } from "./types.js";

export function analyzeWaitRepairs(scripts: LoadedScript[]): {
  suggestions: RepairSuggestion[];
  waitStabilityScore: number;
} {
  const { issues, stabilityScore } = analyzeWaits(scripts);
  const suggestions: RepairSuggestion[] = issues.map((issue) => ({
    id: issue.id,
    category: "wait",
    severity:
      issue.severity === "critical"
        ? "critical"
        : issue.severity === "high"
          ? "high"
          : issue.severity === "medium"
            ? "medium"
            : "low",
    confidence: issue.confidence,
    priority: issue.impactScore,
    title: issue.title,
    detail: issue.detail,
    whyItMatters: issue.whyItMatters,
    affectedFiles: issue.affectedFiles,
    suggestedFix: issue.suggestedSolution,
    autoApplicable: issue.id.includes("thread"),
    beforeExample: issue.beforeExample,
    afterExample: issue.afterExample,
  }));

  return { suggestions, waitStabilityScore: stabilityScore };
}
