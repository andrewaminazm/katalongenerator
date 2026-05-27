import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { ArchitectureInsight, RefactorIssue } from "./types.js";

export function analyzeProjectStructure(
  index: ProjectIndex,
  scripts: LoadedScript[]
): { insights: ArchitectureInsight[]; issues: RefactorIssue[]; complexityScore: number } {
  const insights: ArchitectureInsight[] = [];
  const issues: RefactorIssue[] = [];

  const apiScripts = scripts.filter((s) => /\/API\//i.test(s.scriptPath) || /\bWS\./i.test(s.content));
  const uiScripts = scripts.filter((s) => !apiScripts.includes(s));
  if (apiScripts.length > 0 && uiScripts.length > 0) {
    const mixed = scripts.filter(
      (s) => /\bWebUI\./i.test(s.content) && /\bWS\.sendRequest/i.test(s.content)
    );
    if (mixed.length > 0) {
      issues.push({
        id: "arch-mixed-ui-api",
        category: "architecture",
        severity: "medium",
        confidence: 0.82,
        impactScore: 60,
        fixComplexity: "medium",
        title: `${mixed.length} script(s) mix WebUI and API in one test case`,
        detail: "UI and API concerns should usually be split for clarity and reuse.",
        whyItMatters: "Mixed tests are harder to debug and reuse in API-only CI jobs.",
        affectedFiles: mixed.map((s) => s.logicalPath),
        suggestedSolution: "API setup via Keywords/api; UI tests call keywords without inline WS.sendRequest.",
      });
      insights.push({
        id: "arch-separate-api",
        area: "API/UI separation",
        insight: `${apiScripts.length} API-oriented vs ${uiScripts.length} UI-oriented scripts detected`,
        recommendation: "Keep Scripts/API and Scripts/UI (or Test Cases) folders distinct",
        severity: "info",
      });
    }
  }

  const longScripts = scripts.filter((s) => s.content.split(/\n/).length > 120);
  for (const s of longScripts.slice(0, 8)) {
    issues.push({
      id: `struct-long-${s.scriptPath}`,
      category: "structure",
      severity: "medium",
      confidence: 0.85,
      impactScore: 55,
      fixComplexity: "medium",
      title: `Long test case: ${s.logicalPath}`,
      detail: `${s.content.split(/\n/).length} lines — consider splitting or keyword extraction.`,
      whyItMatters: "Long tests hide multiple scenarios and fail opaquely.",
      affectedFiles: [s.scriptPath],
      suggestedSolution: "Split into focused test cases or extract phases into keywords.",
    });
  }

  const hardcoded = scripts.filter((s) =>
    /https?:\/\/[^\s'"]+|password\s*=\s*['"][^'"]+['"]/i.test(s.content)
  );
  if (hardcoded.length > 5) {
    issues.push({
      id: "struct-hardcoded",
      category: "structure",
      severity: "high",
      confidence: 0.78,
      impactScore: 72,
      fixComplexity: "medium",
      title: `${hardcoded.length} script(s) with hardcoded URLs or credentials`,
      detail: "Use Profiles/GlobalVariable and openToUrl keywords instead.",
      whyItMatters: "Hardcoded values block environment promotion and violate security hygiene.",
      affectedFiles: hardcoded.slice(0, 8).map((s) => s.logicalPath),
      suggestedSolution: "Move URLs to defaultUrl profile; secrets to encrypted test data.",
    });
  }

  if (index.testSuitePaths.length === 0 && scripts.length > 10) {
    insights.push({
      id: "arch-no-suites",
      area: "Test suites",
      insight: "No Test Suites detected in index — suite-level regression planning may be manual",
      recommendation: "Define Test Suites aligned to regression tiers (smoke, full)",
      severity: "low",
    });
  }

  const depthPenalty = longScripts.length * 5 + hardcoded.length * 4 + (mixedUiApi(scripts) ? 10 : 0);
  const complexityScore = Math.max(0, Math.min(100, 100 - depthPenalty));

  return { insights, issues, complexityScore };
}

function mixedUiApi(scripts: LoadedScript[]): boolean {
  return scripts.some((s) => /\bWebUI\./i.test(s.content) && /\bWS\./i.test(s.content));
}
