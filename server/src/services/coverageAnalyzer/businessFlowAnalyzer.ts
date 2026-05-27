import type { ParsedTestScript } from "../projectIntelligence/types.js";
import type { BusinessFlowCoverage, MissingScenarioFinding } from "./types.js";

const FLOW_KEYWORDS: Record<string, RegExp> = {
  Login: /\b(login|sign[\s-]?in|auth|credential|password)\b/i,
  Checkout: /\b(checkout|cart|payment|order|purchase)\b/i,
  Search: /\b(search|filter|query|find)\b/i,
  Registration: /\b(register|sign[\s-]?up|create[\s-]?account)\b/i,
  Profile: /\b(profile|account|settings|my[\s-]?account)\b/i,
  Refund: /\b(refund|cancel|return)\b/i,
};

const EDGE_CASES: Record<string, string[]> = {
  Login: ["invalid password", "locked account", "session timeout", "MFA challenge"],
  Checkout: ["declined card", "empty cart", "expired coupon", "inventory unavailable"],
  Search: ["no results", "special characters", "pagination boundary"],
  Registration: ["duplicate email", "weak password policy", "email verification"],
};

function scriptMatchesFlow(script: ParsedTestScript, re: RegExp): boolean {
  const blob = [
    script.logicalPath,
    script.displayName,
    script.semanticSummary,
    ...script.stepComments,
    ...script.findTestObjectRefs,
    ...script.customKeywordRefs,
  ].join(" ");
  return re.test(blob);
}

export function analyzeBusinessFlows(scripts: ParsedTestScript[]): {
  flows: BusinessFlowCoverage[];
  missing: MissingScenarioFinding[];
} {
  const flows: BusinessFlowCoverage[] = [];
  const missing: MissingScenarioFinding[] = [];

  for (const [name, re] of Object.entries(FLOW_KEYWORDS)) {
    const related = scripts.filter((s) => scriptMatchesFlow(s, re));
    const edges = EDGE_CASES[name] ?? [];
    const gaps: string[] = [];

    if (related.length === 0) {
      gaps.push(`No indexed tests match the ${name} flow pattern`);
      missing.push({
        id: `flow-${name.toLowerCase()}-missing`,
        module: name,
        scenario: `Implement ${name} end-to-end coverage`,
        severity: "high",
        source: "business",
      });
    } else {
      const blob = related
        .map((s) => `${s.logicalPath} ${s.semanticSummary}`)
        .join(" ")
        .toLowerCase();
      for (const edge of edges) {
        if (!blob.includes(edge.split(" ")[0]!.toLowerCase())) {
          gaps.push(`Possible missing edge case: ${edge}`);
          missing.push({
            id: `flow-${name}-${edge.replace(/\s+/g, "-")}`,
            module: name,
            scenario: edge,
            severity: "medium",
            source: "business",
          });
        }
      }
    }

    const coveragePercent =
      related.length === 0 ? 0 : Math.max(20, Math.min(95, 100 - gaps.length * 18));

    flows.push({
      name,
      coveragePercent,
      relatedScripts: related.map((s) => s.logicalPath).slice(0, 20),
      gaps,
      riskLevel: related.length === 0 ? "critical" : gaps.length > 2 ? "high" : gaps.length ? "medium" : "low",
    });
  }

  return { flows, missing };
}
