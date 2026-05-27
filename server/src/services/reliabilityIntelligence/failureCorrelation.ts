import type { FailureAnalysisResult } from "../failureAnalysis/types.js";
import type { FailureClusterSummary } from "./types.js";
import { getFailurePatterns } from "../failureAnalysis/failurePatternMemory.js";

export async function buildSemanticClusters(
  failure: FailureAnalysisResult
): Promise<{ clusterLabel: string; clusterId: string; clusters: FailureClusterSummary[] }> {
  const patterns = await getFailurePatterns();
  const typePatterns = patterns.filter((p) => p.failureType === failure.failureType);

  const clusters: FailureClusterSummary[] = typePatterns.slice(0, 8).map((p, i) => ({
    clusterId: `cluster-${i}`,
    label: p.signature.slice(0, 60) || failure.failureType,
    memberCount: p.count,
    sharedRootCause: p.signature,
    failureTypes: [p.failureType],
  }));

  const match = patterns.find(
    (p) =>
      p.signature ===
        `${failure.failureType}:${failure.rootCauseSummary}`.toLowerCase().slice(0, 120) ||
      p.failureType === failure.failureType
  );

  const clusterLabel = match
    ? `${match.count} historical failures share: ${match.signature.slice(0, 80)}`
    : `${failure.failureType} — ${failure.rootCauseSummary.slice(0, 60)}`;

  return {
    clusterLabel,
    clusterId: match?.signature ?? `single-${failure.failureType}`,
    clusters,
  };
}

export function correlateEvidenceLayers(
  failure: FailureAnalysisResult,
  corpus: string
): string[] {
  const factors: string[] = [];
  if (failure.locatorInsights) {
    factors.push(`Locator: ${failure.locatorInsights.problem}`);
    if (failure.locatorInsights.domChangeLikely) factors.push("DOM change likely after element located");
    if (failure.locatorInsights.isDynamic) factors.push("Dynamic locator strategy detected");
  }
  if (failure.timingInsights) {
    factors.push(`Timing: ${failure.timingInsights.problem}`);
    if (failure.timingInsights.raceConditionLikely) factors.push("Race condition / spinner overlay likely");
  }
  if (failure.apiInsights) factors.push(`API: ${failure.apiInsights.problem}`);
  if (/react|vue|angular|rerender|hydration/i.test(corpus)) {
    factors.push("SPA framework re-render may invalidate locators");
  }
  if (/spinner|loading|overlay|modal/i.test(corpus)) factors.push("Loading overlay may block interaction");
  if (failure.screenshotInsights?.length) {
    factors.push(`Visual: ${failure.screenshotInsights[0]}`);
  }
  if (failure.executionLogInsights?.retryAttempts) {
    factors.push(`Retries in log: ${failure.executionLogInsights.retryAttempts}`);
  }
  return factors;
}
