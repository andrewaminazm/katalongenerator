import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPlainEnglishReport } from "./plainEnglishReport.js";
import type { FailureAnalysisResult } from "./types.js";

function minimalDraft(overrides: Partial<FailureAnalysisResult> = {}): FailureAnalysisResult {
  return {
    rootCause: "x",
    rootCauseSummary: "y",
    failureType: "FRAMEWORK",
    flakyProbability: 0.2,
    flakyLevel: "low",
    confidence: 0.8,
    rootCauseConfidence: 0.8,
    suggestedFixConfidence: 0.7,
    logOnlyMode: true,
    detectedPatterns: [],
    affectedLayer: "framework",
    severity: "medium",
    reproducibility: "likely",
    secondaryFactors: [],
    suggestedFixes: [],
    recommendedArchitectureImprovements: [],
    relatedPatterns: [],
    healingSuggestions: [],
    timeline: [],
    architectureInsights: [],
    aiEnhanced: false,
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("buildPlainEnglishReport", () => {
  it("explains window/tab URL failures in plain language", () => {
    const corpus = `Test Cases/footer/links/TC01_FooterLink_MinistryOfFinance_NewTab FAILED.
StepFailedException: Unable to get the url of the current window`;

    const report = buildPlainEnglishReport(
      minimalDraft({ failureType: "BROWSER_AUTOMATION" }),
      corpus,
      null,
      {}
    );

    assert.match(report.headline, /tab|window/i);
    assert.match(report.whatHappened, /TC01_FooterLink|new tab|tab/i);
    assert.ok(report.stepsToTry.some((s) => /switchToWindow/i.test(s)));
    assert.match(report.errorSnippet!, /Unable to get the url/i);
  });
});
