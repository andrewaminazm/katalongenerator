import { buildArchitectureInsights } from "../refactorAssistant/frameworkArchitectureAnalyzer.js";
import { analyzeProjectStructure } from "../refactorAssistant/projectStructureAnalyzer.js";
import { analyzeKeywordRefactoring } from "../refactorAssistant/keywordRefactorAnalyzer.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";
import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RepairSuggestion } from "./types.js";

export function analyzeFrameworkRepairs(
  index: ProjectIndex,
  graph: ProjectGraphV2,
  scripts: LoadedScript[]
): {
  suggestions: RepairSuggestion[];
  architectureWarnings: { area: string; warning: string; recommendation: string }[];
  modularityScore: number;
} {
  const structure = analyzeProjectStructure(index, scripts);
  const kw = analyzeKeywordRefactoring(index, graph);
  const archInsights = buildArchitectureInsights(index);

  const suggestions: RepairSuggestion[] = [
    ...structure.issues.map((issue) => ({
      id: issue.id,
      category: "framework" as const,
      severity:
        issue.severity === "critical"
          ? ("critical" as const)
          : issue.severity === "high"
            ? ("high" as const)
            : issue.severity === "medium"
              ? ("medium" as const)
              : ("low" as const),
      confidence: issue.confidence,
      priority: issue.impactScore,
      title: issue.title,
      detail: issue.detail,
      whyItMatters: issue.whyItMatters,
      affectedFiles: issue.affectedFiles,
      suggestedFix: issue.suggestedSolution,
      autoApplicable: false,
    })),
    ...kw.issues.map((issue) => ({
      id: issue.id,
      category: "framework" as const,
      severity:
        issue.severity === "critical"
          ? ("critical" as const)
          : issue.severity === "high"
            ? ("high" as const)
            : issue.severity === "medium"
              ? ("medium" as const)
              : ("low" as const),
      confidence: issue.confidence,
      priority: issue.impactScore,
      title: issue.title,
      detail: issue.detail,
      whyItMatters: issue.whyItMatters,
      affectedFiles: issue.affectedFiles,
      suggestedFix: issue.suggestedSolution,
      autoApplicable: false,
    })),
  ];

  const architectureWarnings = archInsights.map((a) => ({
    area: a.area,
    warning: a.insight,
    recommendation: a.recommendation,
  }));

  return {
    suggestions,
    architectureWarnings,
    modularityScore: kw.modularityScore,
  };
}
