import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RepairSuggestion } from "./types.js";

export function analyzeApiRepairs(scripts: LoadedScript[]): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];
  const apiScripts = scripts.filter(
    (s) =>
      /\/API\//i.test(s.logicalPath) ||
      /\bWS\.|RequestObject|sendRequest|Restful/i.test(s.content)
  );

  for (const s of apiScripts) {
    if (!/verifyResponseStatusCode|verifyElementPropertyValue|assert/i.test(s.content)) {
      suggestions.push({
        id: `api-weak-assert-${s.scriptPath}`,
        category: "api",
        severity: "medium",
        confidence: 0.75,
        priority: 58,
        title: `Weak API validation in ${s.logicalPath}`,
        detail: "No clear status or schema validation detected.",
        whyItMatters: "API tests without assertions give false confidence.",
        affectedFiles: [s.scriptPath],
        suggestedFix: "Add WS.verifyResponseStatusCode and schema/body checks.",
        autoApplicable: false,
      });
    }

    const authCalls = (s.content.match(/\b(login|token|bearer|Authorization)\b/gi) ?? []).length;
    if (authCalls > 3) {
      suggestions.push({
        id: `api-dup-auth-${s.scriptPath}`,
        category: "api",
        severity: "medium",
        confidence: 0.7,
        priority: 52,
        title: `Duplicated auth logic in ${s.logicalPath}`,
        detail: "Multiple auth/token patterns in one script.",
        whyItMatters: "Centralize auth in AuthManager / API helper keywords.",
        affectedFiles: [s.scriptPath],
        suggestedFix: "Extract to CustomKeywords API AuthHelper.",
        autoApplicable: false,
      });
    }
  }

  if (apiScripts.length === 0) {
    suggestions.push({
      id: "api-no-layer",
      category: "api",
      severity: "info",
      confidence: 0.6,
      priority: 25,
      title: "No indexed API test layer detected",
      detail: "Consider adding Scripts/API with reusable WS clients.",
      whyItMatters: "Microservice projects benefit from a dedicated API framework module.",
      affectedFiles: [],
      suggestedFix: "Use AI Project Generator API template or API Test tab.",
      autoApplicable: false,
    });
  }

  return suggestions;
}
