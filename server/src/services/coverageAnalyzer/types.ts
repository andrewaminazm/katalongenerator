import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface CoverageAnalyzeOptions {
  projectId: string;
  swagger?: string;
  postmanCollection?: string;
  requirements?: string;
  forceRefresh?: boolean;
  maxScripts?: number;
}

export interface CoverageModuleScore {
  module: string;
  coverageScore: number;
  riskLevel: RiskLevel;
  assertionScore: number;
  missingScenarios: string[];
  recommendations: string[];
  testScriptCount: number;
  orUsageScore: number;
}

export interface WeakAssertionFinding {
  scriptPath: string;
  logicalPath: string;
  actionCount: number;
  verifyCount: number;
  reason: string;
}

export interface UnusedAssetFinding {
  kind: "test_object" | "keyword" | "test_script";
  path: string;
  reason: string;
}

export interface MissingScenarioFinding {
  id: string;
  module: string;
  scenario: string;
  severity: RiskLevel;
  source: "api" | "flow" | "assertion" | "business" | "ai";
}

export interface BusinessFlowCoverage {
  name: string;
  coveragePercent: number;
  relatedScripts: string[];
  gaps: string[];
  riskLevel: RiskLevel;
}

export interface CoverageRecommendation {
  id: string;
  severity: RiskLevel | "info";
  category:
    | "api"
    | "assertion"
    | "or"
    | "keyword"
    | "duplicate"
    | "architecture"
    | "regression"
    | "business";
  title: string;
  detail: string;
  affectedItems?: string[];
}

export interface ApiCoverageSummary {
  totalEndpoints: number;
  referencedInOr: number;
  referencedInScripts: number;
  untestedEndpoints: string[];
  missingStatusValidations: string[];
  coveragePercent: number;
}

export interface CoverageHeatmapCell {
  module: string;
  coverage: number;
  risk: number;
  assertionQuality: number;
}

export interface CoverageAnalysisResult {
  projectId: string;
  projectName: string;
  analyzedAt: string;
  fromCache: boolean;
  overallCoverage: number;
  riskScore: number;
  maintainabilityScore: number;
  flakyIndicatorCount: number;
  missingScenarioCount: number;
  modules: CoverageModuleScore[];
  missingScenarios: MissingScenarioFinding[];
  weakAssertions: WeakAssertionFinding[];
  unusedAssets: UnusedAssetFinding[];
  recommendations: CoverageRecommendation[];
  businessFlows: BusinessFlowCoverage[];
  duplicateFlows: { pattern: string; scripts: string[] }[];
  apiCoverage?: ApiCoverageSummary;
  heatmap: CoverageHeatmapCell[];
  coverageGraph: ProjectGraphV2;
}
