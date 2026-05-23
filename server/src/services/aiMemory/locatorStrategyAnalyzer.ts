import type { LocatorStrategyProfile } from "./types.js";
import type { ParsedTestObject, ParsedTestScript } from "../projectIntelligence/types.js";

export function analyzeLocatorStrategy(
  testObjects: ParsedTestObject[],
  testScripts: ParsedTestScript[]
): LocatorStrategyProfile {
  let findCount = 0;
  let inlineCount = 0;
  const selectorTypes: Record<string, number> = {};

  for (const script of testScripts) {
    for (const ref of script.findTestObjectRefs) {
      findCount++;
      if (ref) void ref;
    }
    const blob = script.webUiCalls.join("\n");
    if (/new\s+TestObject\s*\(/.test(blob) || /addProperty\s*\(/.test(blob)) {
      inlineCount++;
    }
  }

  for (const o of testObjects) {
    const t = o.selectorType ?? "UNKNOWN";
    selectorTypes[t] = (selectorTypes[t] ?? 0) + 1;
  }

  const preferredSelectorTypes = Object.entries(selectorTypes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  const total = findCount + inlineCount || 1;
  let dominant: LocatorStrategyProfile["dominantStrategy"] = "mixed";
  if (findCount / total > 0.65) dominant = "object_repository";
  else if (inlineCount / total > 0.35) dominant = "inline_testobject";

  return {
    findTestObjectRatio: findCount / total,
    inlineTestObjectRatio: inlineCount / total,
    preferredSelectorTypes,
    dominantStrategy: dominant,
    orPathExamples: testObjects.slice(0, 15).map((o) => o.path),
  };
}
