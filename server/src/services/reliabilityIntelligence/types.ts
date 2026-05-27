import type { FailureAnalysisResult, FailureType } from "../failureAnalysis/types.js";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface LocatorHealthEntry {
  orPath: string;
  label: string;
  healthScore: number;
  stabilityScore: number;
  failureCount: number;
  healCount: number;
  reasons: string[];
  recommendations: string[];
}

export interface SmartRepairRecommendation {
  id: string;
  title: string;
  description: string;
  groovySnippet?: string;
  priority: "high" | "medium" | "low";
  repairSuccessPrediction: number;
  category: FailureType | "architecture" | "healing" | "prevention";
}

export interface HistoricalFailureRef {
  id: string;
  analyzedAt: string;
  rootCauseSummary: string;
  failureType: FailureType;
  similarity: number;
}

export interface RegressionImpactSummary {
  impactedTestCases: number;
  impactedKeywords: number;
  impactedOrObjects: number;
  impactedFlows: number;
  riskScore: number;
  topDependencies: string[];
}

export interface EnvironmentInsightSummary {
  environmentIssueLikely: boolean;
  signals: string[];
  falsePositiveRisk: number;
  recommendation: string;
}

export interface BusinessFlowRiskSummary {
  flowName: string;
  stabilityScore: number;
  riskLevel: RiskLevel;
  flakyTrend: "stable" | "degrading" | "unknown";
  notes: string[];
}

export interface HeatmapCell {
  id: string;
  label: string;
  category: "page" | "api" | "flow" | "or" | "module" | "suite";
  riskScore: number;
  failureCount: number;
}

export interface RootCauseGraphNode {
  id: string;
  label: string;
  kind: "step" | "api" | "locator" | "or" | "keyword" | "flow" | "environment";
}

export interface RootCauseGraphEdge {
  from: string;
  to: string;
  relation: string;
}

export interface StabilityTimelinePoint {
  date: string;
  event: string;
  impact: "low" | "medium" | "high";
}

export interface FailureClusterSummary {
  clusterId: string;
  label: string;
  memberCount: number;
  sharedRootCause: string;
  failureTypes: FailureType[];
}

export interface ReliabilityIntelligence {
  rootCauseConfidence: number;
  flakyProbability: number;
  repairSuccessPrediction: number;
  riskLevel: RiskLevel;
  reliabilityScore: number;
  confidenceExplanation: string[];
  failureCluster?: string;
  failureClusterId?: string;
  semanticClusters?: FailureClusterSummary[];
  locatorHealth?: LocatorHealthEntry;
  repairRecommendations: SmartRepairRecommendation[];
  preventiveSuggestions: string[];
  historicalFailures: HistoricalFailureRef[];
  regressionImpact?: RegressionImpactSummary;
  environmentInsights: EnvironmentInsightSummary;
  businessFlowRisk?: BusinessFlowRiskSummary;
  stabilityTimeline: StabilityTimelinePoint[];
  rootCauseGraph: { nodes: RootCauseGraphNode[]; edges: RootCauseGraphEdge[] };
  heatmapSlice: HeatmapCell[];
  frameworkWeaknesses: string[];
  riskAnalysis: string;
}

export interface ProjectReliabilityReport {
  projectId: string;
  projectName: string;
  analyzedAt: string;
  reliabilityScore: number;
  maintainabilityScore: number;
  stabilityScore: number;
  flakyModules: Array<{ module: string; score: number; reasons: string[] }>;
  heatmap: HeatmapCell[];
  businessFlows: BusinessFlowRiskSummary[];
  locatorHealthTop: LocatorHealthEntry[];
  clusters: FailureClusterSummary[];
  trends: StabilityTimelinePoint[];
  recommendations: string[];
}

export interface ReliabilityAnalyzeInput {
  failure: FailureAnalysisResult;
  request: {
    projectId?: string;
    logs?: string;
    stacktrace?: string;
    consoleLogs?: string;
    apiResponse?: string;
    executionMetadata?: FailureAnalysisResult extends { executionLogInsights?: infer _ }
      ? import("../failureAnalysis/types.js").ExecutionMetadata
      : never;
  };
  corpus: string;
}
