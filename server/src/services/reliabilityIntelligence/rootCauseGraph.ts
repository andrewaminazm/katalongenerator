import type { FailureAnalysisResult } from "../failureAnalysis/types.js";
import type { RootCauseGraphEdge, RootCauseGraphNode } from "./types.js";

export function buildRootCauseGraph(
  failure: FailureAnalysisResult,
  corpus: string
): { nodes: RootCauseGraphNode[]; edges: RootCauseGraphEdge[] } {
  const nodes: RootCauseGraphNode[] = [
    { id: "failure", label: failure.rootCauseSummary.slice(0, 40), kind: "step" },
  ];
  const edges: RootCauseGraphEdge[] = [];

  const add = (id: string, label: string, kind: RootCauseGraphNode["kind"], from = "failure", relation = "caused_by") => {
    if (!nodes.find((n) => n.id === id)) nodes.push({ id, label: label.slice(0, 50), kind });
    edges.push({ from, to: id, relation });
  };

  if (failure.executionLogInsights?.failedTestObject) {
    add("or", failure.executionLogInsights.failedTestObject, "or");
  } else if (failure.projectContext?.matchedOrPath) {
    add("or", failure.projectContext.matchedOrPath, "or");
  }

  if (failure.executionLogInsights?.failedKeyword) {
    add("kw", failure.executionLogInsights.failedKeyword, "keyword");
  } else if (failure.projectContext?.matchedKeyword) {
    add("kw", failure.projectContext.matchedKeyword, "keyword");
  }

  if (failure.apiInsights) add("api", failure.apiInsights.problem.slice(0, 40), "api");
  if (failure.timingInsights?.raceConditionLikely) add("timing", "Race / wait issue", "step");
  if (failure.locatorInsights?.domChangeLikely) add("dom", "DOM re-render", "locator");
  if (/auth|token|401|403/i.test(corpus)) add("auth", "Auth / token", "api", "api", "depends_on");
  if (failure.failureType === "ENVIRONMENT") add("env", "Environment instability", "environment");

  const flow = detectFlow(corpus);
  if (flow) add("flow", flow, "flow");

  return { nodes: nodes.slice(0, 12), edges: edges.slice(0, 14) };
}

function detectFlow(corpus: string): string | undefined {
  const c = corpus.toLowerCase();
  if (/checkout|cart|payment/.test(c)) return "Checkout flow";
  if (/login|sign.?in|auth/.test(c)) return "Authentication flow";
  if (/onboard|register/.test(c)) return "Onboarding flow";
  return undefined;
}
