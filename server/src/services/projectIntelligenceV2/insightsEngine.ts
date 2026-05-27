import type { ProjectIndex } from "../projectIntelligence/types.js";
import { analyzeLocatorStrategy } from "../aiMemory/locatorStrategyAnalyzer.js";
import type { FlakyTestInsight, ProjectInsights, ProjectGraphV2, TestCaseFix } from "./types.js";
import { analyzeScriptContent } from "./scriptAnalyzer.js";
import { scoreOrObject } from "./orAnalyzer.js";

export function buildProjectInsights(
  index: ProjectIndex,
  graph: ProjectGraphV2,
  scriptFixes: TestCaseFix[]
): ProjectInsights {
  const scripts = index.testScripts ?? index.testCases ?? [];
  const flakyTests: FlakyTestInsight[] = [];

  for (const s of scripts) {
    const issues = analyzeScriptContent("", s, index);
    let risk = 0;
    const reasons: string[] = [];
    for (const i of issues) {
      if (i.ruleId === "fragile_xpath" || i.ruleId === "missing_wait_after_action") {
        risk += 25;
        reasons.push(i.message);
      }
      if (i.ruleId === "missing_test_object") {
        risk += 40;
        reasons.push(i.message);
      }
    }
    const fix = scriptFixes.find((f) => f.scriptPath === s.scriptPath);
    if (fix?.changed) {
      risk += 15;
      reasons.push("Auto-fix applied — re-run in Katalon Studio");
    }
    if (risk >= 30) {
      flakyTests.push({
        scriptPath: s.scriptPath,
        logicalPath: s.logicalPath,
        riskScore: Math.min(100, risk),
        reasons,
        severity: risk >= 60 ? "critical" : "warning",
      });
    }
  }

  const unusedAssets = [
    ...graph.orphans.testObjects.map((id) => ({
      kind: "test_object" as const,
      id,
      label: id.replace(/^or:/, ""),
      reason: "Not referenced by any indexed test script",
    })),
    ...graph.orphans.keywords.map((id) => ({
      kind: "keyword" as const,
      id,
      label: id.replace(/^kw:/, ""),
      reason: "Not called from any indexed test script",
    })),
  ];

  const lowStabilityOr = index.testObjects.filter((o) => scoreOrObject(o).stabilityScore < 45).length;
  const riskScore = Math.min(
    100,
    Math.round(
      flakyTests.length * 8 +
        unusedAssets.length * 2 +
        lowStabilityOr * 3 +
        graph.duplicates.testObjects.length * 5
    )
  );

  const locatorProfile = analyzeLocatorStrategy(index.testObjects, scripts);
  const refactoringHints = [
    `Dominant locator strategy: ${locatorProfile.dominantStrategy}`,
    graph.duplicates.testObjects.length
      ? `Consolidate ${graph.duplicates.testObjects.length} duplicate selector group(s)`
      : "No duplicate OR selectors detected",
    unusedAssets.length
      ? `Review ${unusedAssets.length} unused asset(s) before deletion`
      : "No orphan OR/keywords in graph",
    flakyTests.length
      ? `${flakyTests.length} script(s) flagged for stability review`
      : "No high-risk scripts from static analysis",
  ];

  return {
    flakyTests: flakyTests.sort((a, b) => b.riskScore - a.riskScore).slice(0, 50),
    unusedAssets: unusedAssets.slice(0, 100),
    riskScore,
    refactoringHints,
    styleProfile: index.codingStyleHints ?? [],
  };
}
