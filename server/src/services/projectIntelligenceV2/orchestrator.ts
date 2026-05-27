import { loadProjectIndex } from "../projectIntelligence/projectStore.js";
import { analyzeLocatorStrategy } from "../aiMemory/locatorStrategyAnalyzer.js";
import type { AnalyzeProjectV2Options, ProjectIntelligenceV2Result } from "./types.js";
import { loadScriptContents } from "./sourceLoader.js";
import { fixAllScripts } from "./scriptFixer.js";
import { buildProjectGraphV2 } from "./projectGraphV2.js";
import { healObjectRepository } from "./orHealer.js";
import { buildProjectInsights } from "./insightsEngine.js";
import {
  generateDocumentation as buildProjectDocs,
  sectionsToMarkdown,
} from "./documentationGenerator.js";
import { analyzeScriptContent } from "./scriptAnalyzer.js";

export async function analyzeProjectV2(
  projectId: string,
  options: AnalyzeProjectV2Options = {}
): Promise<ProjectIntelligenceV2Result> {
  const index = await loadProjectIndex(projectId);
  if (!index) {
    throw new Error("Project not found — upload and index a Katalon project first");
  }

  const warnings: string[] = [];
  const healScripts = options.healScripts !== false;
  const healLocators = options.healLocators !== false;
  const generateDocumentation = options.generateDocumentation !== false;
  const maxScripts = options.maxScripts ?? 150;

  const graph = buildProjectGraphV2(index);

  let scriptFixes: ReturnType<typeof fixAllScripts> = [];
  if (healScripts) {
    const loaded = await loadScriptContents(projectId, index, maxScripts);
    if (!loaded.length) {
      warnings.push("No on-disk Groovy scripts found — re-upload project or use reindex");
      const scripts = index.testScripts ?? [];
      scriptFixes = scripts.slice(0, maxScripts).map((s) => ({
        scriptPath: s.scriptPath,
        logicalPath: s.logicalPath,
        original: "",
        fixed: "",
        diffSummary: ["Source file not available — metadata-only analysis"],
        explanations: analyzeScriptContent("", s, index).map((i) => ({
          ruleId: i.ruleId,
          severity: i.severity,
          confidence: i.confidence,
          reason: i.message,
        })),
        changed: false,
      }));
    } else {
      scriptFixes = fixAllScripts(loaded, index);
    }
  }

  const impactedByOr = graph.reverseEdges.testObjectUsedBy;
  const orFixes = healLocators ? healObjectRepository(index, impactedByOr) : [];

  const insights = buildProjectInsights(index, graph, scriptFixes);

  try {
    const { loadProjectMemory } = await import("../aiMemory/index.js");
    const memory = await loadProjectMemory(projectId);
    if (memory?.codingStyleSummary?.length) {
      insights.styleProfile.unshift(...memory.codingStyleSummary.slice(0, 5));
    }
  } catch {
    warnings.push("AI memory profile not available — using index hints only");
  }

  const locatorProfile = analyzeLocatorStrategy(
    index.testObjects,
    index.testScripts ?? []
  );
  insights.styleProfile.push(`Locator dominance: ${locatorProfile.dominantStrategy}`);

  let documentation: ProjectIntelligenceV2Result["documentation"] = {
    markdown: "",
    sections: {
      overview: "",
      coverageMap: "",
      objectRepositoryGuide: "",
      keywordLibraryGuide: "",
      testExecutionGuide: "",
      flakyRiskReport: "",
    },
  };

  if (generateDocumentation) {
    const sections = buildProjectDocs(index, graph, insights, scriptFixes, orFixes);
    documentation = {
      sections,
      markdown: sectionsToMarkdown(sections),
    };
  }

  return {
    projectId: index.projectId,
    projectName: index.projectName,
    analyzedAt: new Date().toISOString(),
    fixes: {
      testCases: scriptFixes,
      objectRepository: orFixes,
      keywords: index.keywords
        .filter((k) => graph.orphans.keywords.includes(`kw:${k.customKeywordsPath}`))
        .slice(0, 30)
        .map((k) => ({
          filePath: k.filePath,
          className: k.className,
          issue: "Keyword class not referenced by any test script",
          suggestion: "Remove if obsolete, or add to shared flows",
          severity: "info" as const,
          confidence: 0.75,
        })),
    },
    documentation,
    projectGraph: graph,
    insights,
    warnings,
  };
}
