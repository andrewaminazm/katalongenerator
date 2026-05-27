import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";
import type { CoverageRecommendation } from "./types.js";

export function inferModule(logicalPath: string): string {
  const parts = logicalPath.split("/").filter(Boolean);
  if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
  if (parts.length === 1) return parts[0]!;
  return "General";
}

export function analyzeScriptCoverage(
  index: ProjectIndex,
  graph: ProjectGraphV2
): {
  duplicateFlows: { pattern: string; scripts: string[] }[];
  recommendations: CoverageRecommendation[];
  scriptsByModule: Map<string, string[]>;
} {
  const scripts = index.testScripts ?? index.testCases ?? [];
  const scriptsByModule = new Map<string, string[]>();

  for (const s of scripts) {
    const mod = inferModule(s.logicalPath);
    const list = scriptsByModule.get(mod) ?? [];
    list.push(s.logicalPath);
    scriptsByModule.set(mod, list);
  }

  const duplicateFlows = graph.duplicates.flows.map((f) => ({
    pattern: f.pattern,
    scripts: f.scripts,
  }));

  const recommendations: CoverageRecommendation[] = [];

  if (duplicateFlows.length > 0) {
    recommendations.push({
      id: "dup-flows",
      severity: "medium",
      category: "duplicate",
      title: `${duplicateFlows.length} duplicated flow pattern(s)`,
      detail: "Extract shared steps into custom keywords to reduce regression maintenance.",
      affectedItems: duplicateFlows.slice(0, 5).flatMap((d) => d.scripts.slice(0, 3)),
    });
  }

  const orphanScripts = graph.orphans.testScripts.length;
  if (orphanScripts > 0) {
    recommendations.push({
      id: "orphan-scripts",
      severity: "info",
      category: "architecture",
      title: `${orphanScripts} script(s) with no OR/keyword edges`,
      detail: "Scripts may be stubs, data-driven shells, or missing parseable references.",
    });
  }

  return { duplicateFlows, recommendations, scriptsByModule };
}
