import type { ParsedTestObject } from "../projectIntelligence/types.js";
import { scoreHealingCandidate } from "../healing/healingScorer.js";

export interface OrQualityReport {
  orPath: string;
  stabilityScore: number;
  issues: string[];
  selectorPriority: number;
}

const PRIORITY: Record<string, number> = {
  ID: 1,
  NAME: 2,
  BASIC: 3,
  CSS: 4,
  XPATH: 5,
  UNKNOWN: 6,
};

export function scoreOrObject(obj: ParsedTestObject): OrQualityReport {
  const issues: string[] = [];
  let stabilityScore = scoreHealingCandidate(
    obj.selectorType === "XPATH" ? "xpath" : obj.selectorType === "CSS" ? "css" : "id",
    obj.selector
  );

  if (!obj.selector?.trim()) {
    issues.push("Empty primary selector");
    stabilityScore = 10;
  }
  if (obj.selectorType === "XPATH" && /^\/html/i.test(obj.selector)) {
    issues.push("Absolute XPath from /html — brittle");
    stabilityScore = Math.min(stabilityScore, 35);
  }
  if (obj.selector.length > 150) {
    issues.push("Overly long selector");
    stabilityScore -= 15;
  }
  if (/random|uuid|\d{8,}/i.test(obj.selector)) {
    issues.push("Selector may contain dynamic values");
    stabilityScore -= 20;
  }
  if (!/^[a-zA-Z][\w-]*$/.test(obj.label) && obj.label.includes(" ")) {
    issues.push("Label contains spaces — naming convention");
  }

  return {
    orPath: obj.path,
    stabilityScore: Math.max(0, Math.min(100, stabilityScore)),
    issues,
    selectorPriority: PRIORITY[obj.selectorType] ?? 6,
  };
}

export function findDuplicateSelectors(
  testObjects: ParsedTestObject[]
): { selector: string; paths: string[] }[] {
  const bySel = new Map<string, string[]>();
  for (const o of testObjects) {
    const key = `${o.selectorType}::${o.selector.trim()}`;
    if (!o.selector.trim()) continue;
    const list = bySel.get(key) ?? [];
    list.push(o.path);
    bySel.set(key, list);
  }
  return [...bySel.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([selector, paths]) => ({ selector, paths }));
}
