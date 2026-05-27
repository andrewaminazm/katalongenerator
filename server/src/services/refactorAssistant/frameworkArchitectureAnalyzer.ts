import { analyzeFrameworkArchitecture } from "../aiMemory/frameworkArchitectureAnalyzer.js";
import { detectAntiPatterns } from "../aiMemory/codingStyleProfiler.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ArchitectureInsight } from "./types.js";

export function buildArchitectureInsights(index: ProjectIndex): ArchitectureInsight[] {
  const testScripts = index.testScripts ?? [];
  const arch = analyzeFrameworkArchitecture(index.keywords, testScripts);
  const antiPatterns = detectAntiPatterns(testScripts, arch.keywordDrivenScore);
  const insights: ArchitectureInsight[] = [];

  const patternLabel = arch.hasBaseTestPattern
    ? "Base test / layered keywords"
    : arch.pageObjectHints.length > 0
      ? "Page-object style keywords"
      : arch.keywordDrivenScore > 0.5
        ? "Keyword-driven"
        : "Script-centric (inline WebUI)";

  insights.push({
    id: "arch-pattern",
    area: "Framework pattern",
    insight: patternLabel,
    recommendation:
      arch.keywordDrivenScore < 0.4
        ? "Extract repeated WebUI sequences into Custom Keywords"
        : "Keep new tests calling existing keywords for consistency",
    severity: "info",
  });

  if (arch.utilityClassHints.length > 8) {
    insights.push({
      id: "arch-many-utilities",
      area: "Utilities",
      insight: `${arch.utilityClassHints.length} helper-style keyword classes detected`,
      recommendation: "Consolidate overlapping Utils/Helper classes to reduce discovery cost",
      severity: "low",
    });
  }

  for (const ap of antiPatterns.slice(0, 5)) {
    insights.push({
      id: `arch-ap-${ap.kind}`,
      area: "Anti-pattern",
      insight: ap.message,
      recommendation: "Address in the next refactoring sprint",
      severity: ap.severity === "warning" ? "medium" : "low",
    });
  }

  const kwCount = index.keywords.length;
  const scriptCount = index.stats.testScripts;
  if (scriptCount > 0 && kwCount / scriptCount < 0.05) {
    insights.push({
      id: "arch-low-keyword-ratio",
      area: "Reusability",
      insight: `Low keyword-to-script ratio (${kwCount} keywords / ${scriptCount} scripts)`,
      recommendation: "Extract repeated flows into Custom Keywords to improve reuse",
      severity: "medium",
    });
  }

  return insights;
}
