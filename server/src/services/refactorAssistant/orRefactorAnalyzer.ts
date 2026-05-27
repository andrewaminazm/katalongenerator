import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";
import { findDuplicateSelectors, scoreOrObject } from "../projectIntelligenceV2/orAnalyzer.js";
import type { OrProblemFinding, RefactorIssue } from "./types.js";

export function analyzeOrRefactoring(
  index: ProjectIndex,
  graph: ProjectGraphV2
): { orProblems: OrProblemFinding[]; issues: RefactorIssue[]; orHealthScore: number } {
  const orProblems: OrProblemFinding[] = [];
  const issues: RefactorIssue[] = [];

  for (const id of graph.orphans.testObjects) {
    const path = id.replace(/^or:/, "");
    orProblems.push({
      path,
      problem: "Unused in indexed scripts",
      recommendation: "Remove or reference from a shared setup keyword",
    });
  }

  const dups = findDuplicateSelectors(index.testObjects);
  for (const d of dups.slice(0, 15)) {
    orProblems.push({
      path: d.paths.join(", "),
      problem: "Duplicate selector",
      recommendation: "Merge into one canonical OR entry",
    });
    issues.push({
      id: `or-dup-${d.selector.slice(0, 20)}`,
      category: "or",
      severity: "medium",
      confidence: 0.9,
      impactScore: 60,
      fixComplexity: "medium",
      title: "Duplicate OR selectors",
      detail: `${d.paths.length} objects share: ${d.selector.slice(0, 60)}`,
      whyItMatters: "Duplicate OR entries drift apart when locators are updated in only one place.",
      affectedFiles: d.paths,
      suggestedSolution: "Pick one canonical object; update findTestObject refs; delete duplicates.",
    });
  }

  const folders = new Map<string, number>();
  for (const o of index.testObjects) {
    const parts = o.path.split("/");
    const folder = parts.length > 1 ? parts.slice(0, -1).join("/") : "root";
    folders.set(folder, (folders.get(folder) ?? 0) + 1);
  }
  const vagueFolders = [...folders.entries()].filter(([name]) =>
    /^Page\d+$/i.test(name.split("/").pop() ?? "") || name === "root"
  );
  if (vagueFolders.length > 0) {
    issues.push({
      id: "or-naming-folders",
      category: "or",
      severity: "low",
      confidence: 0.75,
      impactScore: 40,
      fixComplexity: "high",
      title: "OR folder naming lacks semantic grouping",
      detail: `Folders like ${vagueFolders.map(([n]) => n).slice(0, 5).join(", ")} should reflect pages or features.`,
      whyItMatters: "Semantic OR structure speeds authoring and reduces wrong-object picks.",
      affectedFiles: vagueFolders.map(([n]) => n),
      suggestedSolution: "Reorganize under Page_Login, Page_Checkout, API, Common_Components.",
    });
  }

  const weak = index.testObjects.filter((o) => scoreOrObject(o).stabilityScore < 45);
  for (const o of weak.slice(0, 10)) {
    orProblems.push({
      path: o.path,
      problem: "Low locator stability score",
      recommendation: "Prefer data-testid, short CSS, or role-based selectors",
    });
  }

  const used = index.testObjects.length - graph.orphans.testObjects.length;
  const orHealthScore =
    index.testObjects.length === 0
      ? 100
      : Math.round((used / index.testObjects.length) * 60 + (1 - Math.min(1, dups.length / 15)) * 40);

  if (graph.orphans.testObjects.length > 10) {
    issues.push({
      id: "or-unused-bulk",
      category: "or",
      severity: "medium",
      confidence: 0.92,
      impactScore: 55,
      fixComplexity: "low",
      title: `${graph.orphans.testObjects.length} unused OR objects`,
      detail: "Cleanup candidates — verify in Studio before deletion.",
      whyItMatters: "Dead OR creates noise and slows locator search.",
      affectedFiles: graph.orphans.testObjects.slice(0, 10).map((id) => id.replace(/^or:/, "")),
      suggestedSolution: "Archive unused objects; document shared objects in a Common folder.",
    });
  }

  return { orProblems, issues, orHealthScore };
}
