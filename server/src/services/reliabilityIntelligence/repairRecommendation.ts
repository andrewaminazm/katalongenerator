import type { FailureAnalysisResult, SuggestedFix } from "../failureAnalysis/types.js";
import type { SmartRepairRecommendation } from "./types.js";
import type { LocatorHealthEntry } from "./types.js";

export function buildSmartRepairs(
  failure: FailureAnalysisResult,
  repairSuccessPrediction: number,
  locatorHealth?: LocatorHealthEntry
): SmartRepairRecommendation[] {
  const orRef =
    failure.projectContext?.matchedOrPath ??
    failure.executionLogInsights?.failedTestObject ??
    "Page/element";

  return failure.suggestedFixes.map((fix, i) => ({
    id: `smart-${fix.id}`,
    title: fix.title,
    description: fix.description,
    groovySnippet: fix.codeExample ?? buildGroovySnippet(fix, orRef, failure, locatorHealth),
    priority: fix.priority,
    repairSuccessPrediction: Math.max(
      30,
      Math.min(95, repairSuccessPrediction - (fix.priority === "low" ? 10 : 0) + (i === 0 ? 5 : 0))
    ),
    category: fix.category,
  }));
}

function buildGroovySnippet(
  fix: SuggestedFix,
  orRef: string,
  failure: FailureAnalysisResult,
  locatorHealth?: LocatorHealthEntry
): string | undefined {
  if (fix.codeExample) return fix.codeExample;

  const path = orRef.includes("/") ? orRef : `Page_Login/${orRef}`;
  if (fix.category === "LOCATOR" || failure.failureType === "LOCATOR") {
    return [
      `WebUI.waitForElementClickable(findTestObject('${path}'), 15)`,
      `WebUI.click(findTestObject('${path}'))`,
      locatorHealth?.healthScore && locatorHealth.healthScore < 40
        ? `// Locator health ${locatorHealth.healthScore}% — consider data-testid`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (fix.category === "TIMING") {
    return `WebUI.waitForElementVisible(findTestObject('${path}'), 30)`;
  }
  return undefined;
}
