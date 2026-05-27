import { analyzeAssertions } from "../coverageAnalyzer/assertionAnalyzer.js";
import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RefactorIssue, WeakAssertionFinding } from "./types.js";

export function analyzeAssertionQuality(scripts: LoadedScript[]): {
  issues: RefactorIssue[];
  weakAssertions: WeakAssertionFinding[];
  qualityScore: number;
} {
  const { findings, averageAssertionRatio } = analyzeAssertions(scripts);
  const issues: RefactorIssue[] = [];
  const weakAssertions: WeakAssertionFinding[] = findings.map((f) => ({
    scriptPath: f.scriptPath,
    logicalPath: f.logicalPath,
    reason: f.reason,
    suggestion:
      "Add WebUI.verify* or WS.verifyResponseStatusCode with business-meaningful expected values after each critical action.",
  }));

  if (findings.length > 0) {
    issues.push({
      id: "assertion-validation-light",
      category: "assertion",
      severity: findings.length > 10 ? "high" : "medium",
      confidence: 0.88,
      impactScore: 75,
      fixComplexity: "medium",
      title: `${findings.length} validation-light test script(s)`,
      detail: "Scripts contain many actions but few verify/assert calls.",
      whyItMatters: "Tests that only click through flows miss regressions — assertions define pass/fail value.",
      affectedFiles: findings.slice(0, 12).map((f) => f.logicalPath),
      suggestedSolution: "Introduce a team standard: minimum one business validation per user journey step.",
      beforeExample: "WebUI.click(findTestObject('btn_Submit'))",
      afterExample:
        "WebUI.click(findTestObject('btn_Submit'))\nWebUI.verifyElementVisible(findTestObject('lbl_Success'))",
    });
  }

  const verifyTextOnly = scripts.filter((s) =>
    /\bverifyTextPresent\s*\(/i.test(s.content) && !/\bverifyElement\w+/i.test(s.content)
  );
  if (verifyTextOnly.length > 3) {
    issues.push({
      id: "assertion-verify-text",
      category: "assertion",
      severity: "medium",
      confidence: 0.7,
      impactScore: 50,
      fixComplexity: "low",
      title: "Over-reliance on verifyTextPresent",
      detail: `${verifyTextOnly.length} script(s) use verifyTextPresent without stronger element checks.`,
      whyItMatters: "Text-only checks break with i18n and dynamic DOM; prefer OR-backed element verification.",
      affectedFiles: verifyTextOnly.slice(0, 8).map((s) => s.logicalPath),
      suggestedSolution: "Use verifyElementVisible/Text on Object Repository objects tied to stable attributes.",
    });
  }

  const qualityScore = Math.round(averageAssertionRatio * 100);

  return { issues, weakAssertions, qualityScore };
}
