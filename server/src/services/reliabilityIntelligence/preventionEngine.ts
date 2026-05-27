import type { FailureAnalysisResult } from "../failureAnalysis/types.js";
import { loadProjectIndex } from "../projectIntelligence/index.js";

export function buildPreventiveSuggestions(
  failure: FailureAnalysisResult,
  corpus: string
): string[] {
  const tips: string[] = [];

  if (failure.failureType === "LOCATOR" || failure.locatorInsights) {
    tips.push("Add waitForElementClickable before click on dynamic pages");
    tips.push("Audit OR for index-based XPath — migrate to data-testid");
  }
  if (failure.failureType === "TIMING" || failure.timingInsights) {
    tips.push("Replace WebUI.delay() with explicit wait helpers");
    tips.push("Wait for spinners/overlays to disappear before assertions");
  }
  if (failure.failureType === "API" || failure.apiInsights) {
    tips.push("Chain auth token refresh in API helper before dependent calls");
    tips.push("Add schema validation and retry on 5xx with backoff");
  }
  if (/duplicate|copy.*paste/i.test(corpus)) {
    tips.push("Extract duplicated steps into Custom Keywords");
  }
  if (failure.flakyProbability > 0.5) {
    tips.push("Tag suite as flaky and run in quarantine until locator/wait fixes land");
  }
  tips.push("Run Project Repair analyze for project-wide weak locator scan");

  return [...new Set(tips)].slice(0, 8);
}

export async function analyzeProjectPrevention(projectId: string): Promise<string[]> {
  const index = await loadProjectIndex(projectId);
  if (!index) return [];

  const tips: string[] = [];
  if (index.stats.testScripts > 50 && index.stats.keywords < 5) {
    tips.push("High script count with few keywords — extract reusable flows");
  }
  if (index.codingStyleHints.some((h) => /delay\(\)/i.test(h))) {
    tips.push("Project uses fixed delays — standardize WaitHelper pattern");
  }
  return tips;
}
