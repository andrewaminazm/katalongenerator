import { analyzeDuplication } from "../refactorAssistant/duplicationAnalyzer.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";
import type { RepairSuggestion } from "./types.js";

export function detectDuplicateCode(
  index: ProjectIndex,
  graph: ProjectGraphV2
): {
  suggestions: RepairSuggestion[];
  duplicateFlows: { pattern: string; scripts: string[]; suggestedKeyword?: string }[];
  duplicationScore: number;
} {
  const dup = analyzeDuplication(index, graph);
  const suggestions: RepairSuggestion[] = dup.issues.map((issue) => ({
    id: issue.id,
    category: "duplicate",
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
  }));

  const duplicateFlows = dup.duplicateFlows ?? [];

  return {
    suggestions,
    duplicateFlows,
    duplicationScore: dup.duplicationScore,
  };
}
