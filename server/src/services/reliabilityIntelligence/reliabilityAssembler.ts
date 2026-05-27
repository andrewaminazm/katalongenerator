import type { FailureAnalysisRequest, FailureAnalysisResult } from "../failureAnalysis/types.js";
import { learnFromInput } from "../workspaceMemory/learningEngine.js";
import { analyzeBusinessFlowRisk } from "./businessFlowAnalyzer.js";
import { buildSemanticClusters, correlateEvidenceLayers } from "./failureCorrelation.js";
import { buildStabilityTimeline } from "./failureTimeline.js";
import { analyzeProjectFlakiness } from "./flakyEngine.js";
import { buildProjectHeatmap, heatmapSliceFromFailure } from "./heatmapGenerator.js";
import { analyzeLocatorHealth } from "./locatorHealthEngine.js";
import { buildEnvironmentInsights } from "./environmentAnalyzer.js";
import { detectFrameworkWeaknesses, weaknessesFromFailure } from "./frameworkWeaknessDetector.js";
import { buildPreventiveSuggestions, analyzeProjectPrevention } from "./preventionEngine.js";
import { predictRegressionImpact } from "./regressionPredictor.js";
import { buildSmartRepairs } from "./repairRecommendation.js";
import { recordReliabilityMemory } from "./reliabilityMemory.js";
import { findSimilarHistoricalFailures, listReliabilityMemory } from "./reliabilityMemory.js";
import { computeReliabilityScores } from "./reliabilityScorer.js";
import { buildRootCauseGraph } from "./rootCauseGraph.js";
import type {
  ProjectReliabilityReport,
  ReliabilityIntelligence,
} from "./types.js";
import { loadProjectIndex } from "../projectIntelligence/index.js";
import { scoreOrObject } from "../projectIntelligenceV2/orAnalyzer.js";
import { getFailurePatterns } from "../failureAnalysis/failurePatternMemory.js";

export async function enrichFailureWithReliability(
  failure: FailureAnalysisResult,
  request: FailureAnalysisRequest,
  corpus: string
): Promise<FailureAnalysisResult> {
  const projectId = request.projectId;
  const scores = computeReliabilityScores(failure);
  const { clusterLabel, clusterId, clusters } = await buildSemanticClusters(failure);
  const locatorHealth = await analyzeLocatorHealth(failure, corpus, projectId);
  const historicalFailures = await findSimilarHistoricalFailures(
    failure.rootCauseSummary,
    failure.failureType,
    projectId
  );
  const regressionImpact = projectId
    ? await predictRegressionImpact(projectId, corpus)
    : undefined;
  const environmentInsights = buildEnvironmentInsights(failure, corpus);
  const businessFlowRisk = await analyzeBusinessFlowRisk(failure, corpus, projectId);
  const stabilityTimeline = await buildStabilityTimeline(failure, projectId);
  const rootCauseGraph = buildRootCauseGraph(failure, corpus);
  const correlated = correlateEvidenceLayers(failure, corpus);

  const repairRecommendations = buildSmartRepairs(
    failure,
    scores.repairSuccessPrediction,
    locatorHealth
  );
  const preventiveSuggestions = buildPreventiveSuggestions(failure, corpus);
  const frameworkWeaknesses = [
    ...weaknessesFromFailure(failure),
    ...(projectId ? await detectFrameworkWeaknesses(projectId) : []),
  ].slice(0, 8);

  const reliability: ReliabilityIntelligence = {
    rootCauseConfidence: Math.round(failure.rootCauseConfidence * 100),
    flakyProbability: Math.round(failure.flakyProbability * 100),
    repairSuccessPrediction: scores.repairSuccessPrediction,
    riskLevel: scores.riskLevel,
    reliabilityScore: scores.reliabilityScore,
    confidenceExplanation: [...scores.confidenceExplanation, ...correlated.slice(0, 4)],
    failureCluster: clusterLabel,
    failureClusterId: clusterId,
    semanticClusters: clusters,
    locatorHealth,
    repairRecommendations,
    preventiveSuggestions,
    historicalFailures,
    regressionImpact,
    environmentInsights,
    businessFlowRisk,
    stabilityTimeline,
    rootCauseGraph,
    heatmapSlice: heatmapSliceFromFailure(failure, locatorHealth?.label),
    frameworkWeaknesses,
    riskAnalysis: `Risk ${scores.riskLevel}: ${failure.severity} severity, ${failure.reproducibility} reproduction, ${failure.affectedLayer} layer.`,
  };

  await recordReliabilityMemory({
    id: `rel-${Date.now()}`,
    projectId,
    signature: `${failure.failureType}:${failure.rootCauseSummary}`.slice(0, 120),
    failureType: failure.failureType,
    rootCauseSummary: failure.rootCauseSummary,
    flakyProbability: failure.flakyProbability,
    orPath: locatorHealth?.orPath,
    module: businessFlowRisk?.flowName,
    analyzedAt: failure.analyzedAt,
  });

  if (projectId) {
    try {
      await learnFromInput({
        projectId,
        layer: "repair",
        title: `Failure: ${failure.failureType}`,
        content: `${failure.rootCauseSummary}\nRisk: ${scores.riskLevel}`,
        source: "repair",
      });
    } catch {
      /* workspace memory optional */
    }
  }

  return { ...failure, reliability };
}

export async function analyzeProjectReliability(projectId: string): Promise<ProjectReliabilityReport> {
  const index = await loadProjectIndex(projectId);
  if (!index) throw new Error("Project not found");

  const heatmap = await buildProjectHeatmap(projectId);
  const flakyModules = await analyzeProjectFlakiness(projectId);
  const frameworkWeaknesses = await detectFrameworkWeaknesses(projectId);
  const prevention = await analyzeProjectPrevention(projectId);
  const trends = (await listReliabilityMemory(projectId, 20)).map((h) => ({
    date: h.analyzedAt.slice(0, 10),
    event: `${h.failureType}: ${h.rootCauseSummary.slice(0, 45)}`,
    impact: (h.flakyProbability > 0.6 ? "high" : h.flakyProbability > 0.35 ? "medium" : "low") as
      | "low"
      | "medium"
      | "high",
  }));

  const avgRisk =
    heatmap.length > 0
      ? heatmap.reduce((s, c) => s + c.riskScore, 0) / heatmap.length
      : 40;

  const reliabilityScore = Math.max(10, Math.round(100 - avgRisk * 0.6));
  const maintainabilityScore = Math.max(
    15,
    Math.min(95, 100 - frameworkWeaknesses.length * 8)
  );
  const stabilityScore = Math.max(
    10,
    Math.min(
      95,
      100 -
        (flakyModules[0]?.flakyScore ?? 20) * 0.5 -
        heatmap.filter((h) => h.riskScore > 60).length * 3
    )
  );

  const businessFlows = (index.reusableFlows ?? []).slice(0, 6).map((f) => ({
    flowName: f.name,
    stabilityScore: Math.round(f.confidence * 100),
    riskLevel: f.confidence < 0.5 ? ("HIGH" as const) : ("MEDIUM" as const),
    flakyTrend: "unknown" as const,
    notes: [f.description.slice(0, 80)],
  }));

  const locatorHealthTopSync = index.testObjects
    .map((o) => {
      const q = scoreOrObject(o);
      return {
        orPath: o.path,
        label: o.label,
        healthScore: q.stabilityScore,
        stabilityScore: q.stabilityScore,
        failureCount: 0,
        healCount: 0,
        reasons: q.issues.slice(0, 3),
        recommendations: ["Review selector strategy"],
      };
    })
    .filter((l) => l.healthScore < 60)
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 10);

  const patterns = await getFailurePatterns();
  const clusters = patterns.slice(0, 6).map((p, i) => ({
    clusterId: `c-${i}`,
    label: p.signature.slice(0, 50),
    memberCount: p.count,
    sharedRootCause: p.signature,
    failureTypes: [p.failureType],
  }));

  return {
    projectId,
    projectName: index.projectName,
    analyzedAt: new Date().toISOString(),
    reliabilityScore,
    maintainabilityScore,
    stabilityScore,
    flakyModules: flakyModules.map((f) => ({
      module: f.module,
      score: f.flakyScore,
      reasons: f.reasons,
    })),
    heatmap,
    businessFlows,
    locatorHealthTop: locatorHealthTopSync,
    clusters,
    trends,
    recommendations: [...frameworkWeaknesses, ...prevention].slice(0, 12),
  };
}
