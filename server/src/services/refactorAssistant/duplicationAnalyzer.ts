import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";
import { inferModule } from "../coverageAnalyzer/scriptCoverageAnalyzer.js";
import type { DuplicateFlowFinding, RefactorIssue } from "./types.js";

const FLOW_KEYWORDS: Record<string, string> = {
  login: "common.AuthKeywords.login",
  checkout: "common.CheckoutKeywords.completeCheckout",
  search: "common.SearchKeywords.search",
  setup: "common.TestSetup.openApplication",
};

export function analyzeDuplication(
  index: ProjectIndex,
  graph: ProjectGraphV2
): {
  duplicateFlows: DuplicateFlowFinding[];
  issues: RefactorIssue[];
  duplicationScore: number;
  heatmap: Array<{ module: string; duplicationRisk: number; scriptCount: number }>;
} {
  const duplicateFlows: DuplicateFlowFinding[] = graph.duplicates.flows.map((f) => {
    const lower = f.pattern.toLowerCase();
    let suggestedKeyword = "common.FlowKeywords.runSharedFlow";
    for (const [key, kw] of Object.entries(FLOW_KEYWORDS)) {
      if (lower.includes(key)) {
        suggestedKeyword = kw;
        break;
      }
    }
    return {
      pattern: f.pattern,
      scripts: f.scripts,
      suggestedKeyword,
      estimatedSavings: `Consolidate ${f.scripts.length} scripts into one @Keyword`,
    };
  });

  const issues: RefactorIssue[] = [];

  for (const flow of duplicateFlows) {
    if (flow.scripts.length < 2) continue;
    issues.push({
      id: `dup-flow-${flow.pattern.slice(0, 24)}`,
      category: "duplication",
      severity: flow.scripts.length > 8 ? "high" : "medium",
      confidence: 0.85,
      impactScore: Math.min(95, 40 + flow.scripts.length * 5),
      fixComplexity: flow.scripts.length > 6 ? "high" : "medium",
      title: `Repeated flow across ${flow.scripts.length} test scripts`,
      detail: `Same OR step pattern: ${flow.pattern.slice(0, 80)}…`,
      whyItMatters: "Duplicated flows inflate maintenance — one UI change requires many script edits.",
      affectedFiles: flow.scripts.slice(0, 15),
      suggestedSolution: `Extract to CustomKeywords.'${flow.suggestedKeyword ?? "shared.flow"}' and call from tests.`,
      beforeExample: flow.scripts.slice(0, 2).join("\n// repeated in each script"),
      afterExample: "CustomKeywords.'common.FlowKeywords'.runLoginFlow()",
    });
  }

  const scripts = index.testScripts ?? [];
  const byModule = new Map<string, string[]>();
  for (const s of scripts) {
    const mod = inferModule(s.logicalPath);
    const list = byModule.get(mod) ?? [];
    list.push(s.logicalPath);
    byModule.set(mod, list);
  }

  const heatmap: Array<{ module: string; duplicationRisk: number; scriptCount: number }> = [];
  for (const [module, list] of byModule) {
    const dupInMod = duplicateFlows.filter((d) =>
      d.scripts.some((p) => inferModule(p) === module)
    ).length;
    const risk = Math.min(100, dupInMod * 25 + (list.length > 20 ? 15 : 0));
    heatmap.push({ module, duplicationRisk: risk, scriptCount: list.length });
  }

  const dupCount = duplicateFlows.reduce((a, d) => a + Math.max(0, d.scripts.length - 1), 0);
  const duplicationScore = Math.max(0, Math.min(100, 100 - dupCount * 2));

  return { duplicateFlows, issues, duplicationScore, heatmap };
}
