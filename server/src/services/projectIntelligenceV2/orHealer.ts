import type { ParsedTestObject, ProjectIndex } from "../projectIntelligence/types.js";
import { scoreHealingCandidate } from "../healing/healingScorer.js";
import type { ObjectRepositoryFix } from "./types.js";
import { findDuplicateSelectors, scoreOrObject } from "./orAnalyzer.js";

export function proposeBetterSelector(obj: ParsedTestObject): { type: string; value: string } | null {
  const candidates: { type: string; value: string }[] = [];

  for (const alt of obj.alternativeSelectors) {
    candidates.push({ type: alt.type, value: alt.value });
  }

  if (obj.selectorType === "ID" || obj.selector.startsWith("#")) {
    candidates.unshift({ type: "id", value: obj.selector });
  } else if (obj.selectorType === "NAME") {
    candidates.unshift({ type: "name", value: obj.selector });
  } else {
    candidates.push({ type: obj.selectorType.toLowerCase(), value: obj.selector });
  }

  const xpath = obj.alternativeSelectors.find((a) => a.type === "XPATH")?.value ?? obj.selector;
  if (/@[\w-]+=/.test(xpath)) {
    const attr = xpath.match(/@([\w-]+)=['"]([^'"]+)['"]/);
    if (attr?.[1] === "id") candidates.unshift({ type: "id", value: `#${attr[2]}` });
    if (attr?.[1] === "name") candidates.unshift({ type: "name", value: attr[2] });
  }

  const ranked = candidates
    .filter((c) => c.value.trim())
    .map((c) => ({
      ...c,
      score: scoreHealingCandidate(
        c.type as "id" | "name" | "css" | "xpath",
        c.value
      ),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const currentScore = scoreHealingCandidate(
    obj.selectorType === "XPATH" ? "xpath" : obj.selectorType === "CSS" ? "css" : "id",
    obj.selector
  );

  if (!best || best.score <= currentScore + 5) return null;
  return { type: best.type, value: best.value };
}

export function healObjectRepository(
  index: ProjectIndex,
  impactedByOr: Record<string, string[]>
): ObjectRepositoryFix[] {
  const fixes: ObjectRepositoryFix[] = [];
  const duplicates = findDuplicateSelectors(index.testObjects);

  for (const obj of index.testObjects) {
    const quality = scoreOrObject(obj);
    const proposal = proposeBetterSelector(obj);

    if (proposal && quality.stabilityScore < 70) {
      fixes.push({
        orPath: obj.path,
        label: obj.label,
        oldLocator: { type: obj.selectorType, value: obj.selector },
        newLocator: proposal,
        confidence: Math.min(0.95, quality.stabilityScore / 100 + 0.25),
        reason: `Upgrade selector stability (${quality.issues.join("; ") || "lower-priority strategy"})`,
        severity: quality.stabilityScore < 40 ? "critical" : "warning",
        impactedScripts: impactedByOr[`or:${obj.path}`] ?? [],
      });
    }
  }

  for (const dup of duplicates) {
    const [, ...rest] = dup.paths;
    for (const p of rest) {
      const obj = index.testObjects.find((o) => o.path === p);
      if (!obj) continue;
      fixes.push({
        orPath: p,
        label: obj.label,
        oldLocator: { type: obj.selectorType, value: obj.selector },
        newLocator: { type: obj.selectorType, value: obj.selector },
        confidence: 0.8,
        reason: `Duplicate selector shared with ${dup.paths[0]} — consolidate OR entries`,
        severity: "warning",
        impactedScripts: impactedByOr[`or:${p}`] ?? [],
      });
    }
  }

  return fixes;
}
