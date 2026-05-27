import { analyzeAssertionQuality } from "../refactorAssistant/assertionAnalyzer.js";
import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RepairSuggestion } from "./types.js";

export function analyzeAssertionRepairs(scripts: LoadedScript[]): {
  suggestions: RepairSuggestion[];
  assertionQualityScore: number;
} {
  const { issues, qualityScore } = analyzeAssertionQuality(scripts);
  const suggestions: RepairSuggestion[] = issues.map((issue) => ({
    id: issue.id,
    category: "assertion",
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
    autoApplicable: false,
    beforeExample: issue.beforeExample,
    afterExample: issue.afterExample,
  }));

  return { suggestions, assertionQualityScore: qualityScore };
}
