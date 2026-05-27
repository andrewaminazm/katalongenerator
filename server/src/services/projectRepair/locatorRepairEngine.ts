import type { ProjectIndex } from "../projectIntelligence/types.js";
import { scoreOrObject, findDuplicateSelectors } from "../projectIntelligenceV2/orAnalyzer.js";
import { proposeBetterSelector } from "../projectIntelligenceV2/orHealer.js";
import type { LocatorRepairItem, RepairSuggestion } from "./types.js";

export function analyzeLocators(index: ProjectIndex): {
  suggestions: RepairSuggestion[];
  locatorRepairs: LocatorRepairItem[];
} {
  const suggestions: RepairSuggestion[] = [];
  const locatorRepairs: LocatorRepairItem[] = [];

  const dupes = findDuplicateSelectors(index.testObjects);
  for (const d of dupes.slice(0, 15)) {
    suggestions.push({
      id: `or-dup-${d.selector.slice(0, 40)}`,
      category: "or",
      severity: "medium",
      confidence: 0.85,
      priority: 65,
      title: "Duplicate OR selectors",
      detail: `Selector used in ${d.paths.length} objects: ${d.selector.slice(0, 80)}`,
      whyItMatters: "Duplicate locators increase maintenance and healing cost.",
      affectedFiles: d.paths,
      suggestedFix: "Consolidate into one OR object or use page-specific semantic names.",
      autoApplicable: false,
    });
  }

  for (const obj of index.testObjects.slice(0, 80)) {
    const score = scoreOrObject(obj);
    if (score.stabilityScore >= 55) continue;

    const proposal = proposeBetterSelector(obj);
    const item: LocatorRepairItem = {
      orPath: obj.path,
      label: obj.label,
      problem: score.issues.join("; ") || "Low stability locator",
      oldLocator: { type: obj.selectorType, value: obj.selector },
      newLocator: proposal
        ? { type: proposal.type, value: proposal.value }
        : undefined,
      confidence: proposal ? Math.min(0.95, score.stabilityScore / 100 + 0.2) : score.stabilityScore / 100,
      healingMetadata: proposal
        ? { fallbacks: [obj.selector], score: score.stabilityScore / 100 }
        : undefined,
    };
    locatorRepairs.push(item);

    if (proposal) {
      suggestions.push({
        id: `locator-heal-${obj.path.replace(/[^a-zA-Z0-9]/g, "_")}`,
        category: "locator",
        severity: score.stabilityScore < 35 ? "high" : "medium",
        confidence: item.confidence,
        priority: 70,
        title: `Heal locator: ${obj.label}`,
        detail: `${obj.path} — ${score.issues[0] ?? "weak selector"}`,
        whyItMatters: "Unstable locators are the top cause of flaky UI tests.",
        affectedFiles: [obj.path, obj.sourceFile].filter(Boolean) as string[],
        suggestedFix: `Prefer ${proposal.type}: ${proposal.value}`,
        autoApplicable: false,
        beforeExample: obj.selector,
        afterExample: proposal.value,
      });
    }
  }

  const orphans = index.testObjects.filter((o) => {
    const used = index.testScripts.some((s) =>
      s.findTestObjectRefs.some((r) => r.includes(o.path) || r.includes(o.label))
    );
    return !used;
  });
  if (orphans.length > 5) {
    suggestions.push({
      id: "or-unused-bulk",
      category: "or",
      severity: "info",
      confidence: 0.8,
      priority: 35,
      title: `${orphans.length} unused OR objects`,
      detail: "Objects not referenced by indexed scripts — review before delete.",
      whyItMatters: "Dead OR clutters the repository and confuses new engineers.",
      affectedFiles: orphans.slice(0, 10).map((o) => o.path),
      suggestedFix: "Archive or remove after confirming no dynamic references.",
      autoApplicable: false,
    });
  }

  return { suggestions, locatorRepairs };
}
