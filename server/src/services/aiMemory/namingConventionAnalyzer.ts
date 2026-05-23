import type { NamingConventionProfile } from "./types.js";
import type { ParsedTestObject, ParsedKeywordClass } from "../projectIntelligence/types.js";

function detectLabelPattern(labels: string[]): NamingConventionProfile["testObjectPattern"] {
  if (labels.length === 0) return "unknown";
  let snakePrefix = 0;
  let camel = 0;
  let pascal = 0;
  for (const l of labels) {
    if (/^(btn|txt|inp|chk|lnk|img|div|tab|page)_[A-Za-z]/i.test(l)) snakePrefix++;
    else if (/^[a-z][a-zA-Z0-9]*$/.test(l)) camel++;
    else if (/^[A-Z][a-zA-Z0-9]*$/.test(l)) pascal++;
  }
  const n = labels.length;
  if (snakePrefix / n > 0.4) return "snake_prefix";
  if (camel / n > 0.5) return "camelCase";
  if (pascal / n > 0.5) return "PascalCase";
  return "mixed";
}

function prefixExamples(labels: string[]): string[] {
  const counts = new Map<string, number>();
  for (const l of labels) {
    const m = l.match(/^([a-z]+)_/i);
    if (m) counts.set(m[1].toLowerCase(), (counts.get(m[1].toLowerCase()) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([p]) => `${p}_*`);
}

export function analyzeNamingConventions(
  testObjects: ParsedTestObject[],
  keywords: ParsedKeywordClass[]
): NamingConventionProfile {
  const labels = testObjects.map((o) => o.label).filter(Boolean);
  const methodNames = keywords.flatMap((k) => k.methods.map((m) => m.name));
  const snakeMethods = methodNames.filter((m) => m.includes("_")).length;

  return {
    testObjectLabels: labels.slice(0, 30),
    testObjectPattern: detectLabelPattern(labels),
    testObjectPrefixExamples: prefixExamples(labels),
    methodNaming: snakeMethods > methodNames.length * 0.3 ? "snake_case" : "camelCase",
    classNaming: "PascalCase",
    keywordClassExamples: keywords.slice(0, 12).map((k) => k.className),
  };
}
