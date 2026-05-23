import type { FlowCluster } from "./types.js";
import type { ReusableFlow, ParsedTestScript } from "../projectIntelligence/types.js";

export function extractFlowClusters(
  reusableFlows: ReusableFlow[],
  testScripts: ParsedTestScript[]
): FlowCluster[] {
  const clusters: FlowCluster[] = reusableFlows.map((f) => ({
    flowId: f.id,
    name: f.name,
    occurrenceCount: Math.max(2, Math.round(f.confidence * 10)),
    suggestedKeyword: f.relatedKeywords[0],
    relatedOrPaths: f.relatedOrPaths,
    relatedKeywords: f.relatedKeywords,
    stepPattern: f.stepPattern,
  }));

  const setupScripts = testScripts.filter((s) =>
    /setup|before|init|openBrowser|startApplication/i.test(
      [...s.webUiCalls, s.logicalPath].join(" ")
    )
  );
  if (setupScripts.length >= 2 && !clusters.some((c) => c.flowId === "flow-setup")) {
    clusters.push({
      flowId: "flow-setup",
      name: "Common setup",
      occurrenceCount: setupScripts.length,
      relatedOrPaths: [],
      relatedKeywords: [
        ...new Set(setupScripts.flatMap((s) => s.customKeywordRefs)).values(),
      ].slice(0, 8),
      stepPattern: ["Initialize browser or app", "Navigate to entry URL"],
    });
  }

  return clusters;
}
