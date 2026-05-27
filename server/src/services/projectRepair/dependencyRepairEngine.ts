import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";
import type { RepairSuggestion } from "./types.js";

export function analyzeDependencies(graph: ProjectGraphV2): {
  suggestions: RepairSuggestion[];
  dependencyIssues: { kind: string; from: string; to: string; message: string }[];
} {
  const suggestions: RepairSuggestion[] = [];
  const dependencyIssues: { kind: string; from: string; to: string; message: string }[] = [];

  for (const id of graph.orphans.testObjects.slice(0, 20)) {
    dependencyIssues.push({
      kind: "orphan_or",
      from: id,
      to: "",
      message: "OR object not referenced by any indexed script",
    });
  }
  for (const id of graph.orphans.keywords.slice(0, 20)) {
    dependencyIssues.push({
      kind: "orphan_keyword",
      from: id,
      to: "",
      message: "Custom keyword not called from any indexed script",
    });
  }

  if (graph.orphans.testObjects.length > 0) {
    suggestions.push({
      id: "dep-orphan-or",
      category: "dependency",
      severity: "medium",
      confidence: 0.82,
      priority: 55,
      title: `${graph.orphans.testObjects.length} orphaned OR references`,
      detail: "Test objects exist in index but no script references them.",
      whyItMatters: "Broken or stale OR paths cause findTestObject failures.",
      affectedFiles: graph.orphans.testObjects.slice(0, 8).map((x) => x.replace(/^or:/, "")),
      suggestedFix: "Link scripts to OR or remove unused objects after review.",
      autoApplicable: false,
    });
  }

  for (const d of graph.duplicates.testObjects.slice(0, 8)) {
    suggestions.push({
      id: `dep-dup-or-${d.selector.slice(0, 30)}`,
      category: "dependency",
      severity: "medium",
      confidence: 0.88,
      priority: 60,
      title: "Duplicate OR selector dependency",
      detail: `Same selector on ${d.paths.length} paths`,
      whyItMatters: "Changing one duplicate may break others unexpectedly.",
      affectedFiles: d.paths,
      suggestedFix: "Normalize to a single canonical OR entry.",
      autoApplicable: false,
    });
  }

  return { suggestions, dependencyIssues };
}
