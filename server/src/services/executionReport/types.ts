export type FailureSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type FailureType =
  | "UI"
  | "API"
  | "ASSERTION"
  | "TIMEOUT"
  | "DATA"
  | "ENVIRONMENT"
  | "UNKNOWN";

export type ReleaseStatus = "READY" | "AT_RISK" | "BLOCKED";

export interface FailedTestInput {
  /**
   * Preferred: human-readable bug title (e.g. "Login fails when username has spaces").
   * If not provided, `testCaseName` is used as a fallback for backwards compatibility.
   */
  bugName?: string;
  /** Preferred: Jira issue key/id (e.g. "AUTH-1234"). */
  jiraId?: string;
  /** Backwards-compatible field (legacy). */
  testCaseName?: string;
  module: string;
  /**
   * Optional. Keep for real technical failure details when available.
   * If client only provides Jira, this can be empty.
   */
  errorMessage?: string;
  failureType?: FailureType | string;
  failureSeverity?: FailureSeverity | string;
  stackTraceSummary?: string;
}

export interface TestExecutionInput {
  totalTestCases: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: string;
}

export type DeploymentDecision =
  | "Deploy"
  | "Deploy With Monitoring"
  | "Deploy To Staging Only"
  | "Do Not Deploy"
  | "Block Release";

export interface DeploymentRecommendation {
  decision: DeploymentDecision;
  reasoning: string;
  confidencePercent: number;
  majorRisks: string[];
  requiredActions: string[];
}

export interface ExecutiveIntelligenceSection {
  markdown: string;
  directorStatus: "READY" | "AT RISK" | "BLOCKED" | "CRITICAL";
  deploymentRecommendation: DeploymentRecommendation;
  generatedBy: "deterministic" | "gosi_brain";
  model?: string;
}

export interface ExecutionReportInput {
  projectName: string;
  buildId: string;
  executionDate: string;
  environment: string;
  testExecution: TestExecutionInput;
  failedTests: FailedTestInput[];
  /** Optional CI metadata */
  pipelineName?: string;
  branch?: string;
  triggeredBy?: string;
  /** When true (default), attach 12-section Executive QA Intelligence narrative */
  includeExecutiveIntelligence?: boolean;
  /** When false, skip Gosi Brain and use deterministic narrative only */
  preferAiNarrative?: boolean;
  /** PDF / preview report type — must match client tab selection */
  reportType?: string;
}

export interface ExecutiveSummary {
  headline: string;
  totalTestCases: number;
  passed: number;
  failed: number;
  skipped: number;
  passRatePercent: number;
  duration: string;
  severityCounts: Record<FailureSeverity, number>;
  releaseStatement: string;
  releaseStatus: ReleaseStatus;
}

export interface ExecutionOverview {
  stabilityScore: number;
  riskScore: number;
  environment: string;
  buildId: string;
  executionDate: string;
  ciSummary: string;
}

export interface SeverityAnalysis {
  breakdown: Record<FailureSeverity, number>;
  weightedRiskPoints: number;
  topFailingModules: Array<{ module: string; count: number; maxSeverity: FailureSeverity }>;
  criticalFailures: Array<{
    bugName: string;
    jiraId?: string;
    module: string;
    errorMessage?: string;
    severity: FailureSeverity;
  }>;
}

export interface ModuleRiskRow {
  module: string;
  failureCount: number;
  riskScore: number;
  stabilityScore: number;
  dominantFailureType: string;
}

export interface BusinessFlowRow {
  flowName: string;
  passRatePercent: number;
  riskScore: number;
  failedTests: string[];
  impact: string;
}

export interface FlakyInsights {
  repeatedFailureSignals: string[];
  flakyCandidates: string[];
  stabilityTrend: "stable" | "degrading" | "unknown";
  regressionSignals: string[];
}

export interface ReleaseReadiness {
  score: number;
  status: ReleaseStatus;
  confidencePercent: number;
  blockingIssues: string[];
  factors: string[];
}

export interface RootCauseInsight {
  category: string;
  likelihood: "high" | "medium" | "low";
  summary: string;
}

export interface ChartDataSet {
  passFailPie: { label: string; value: number }[];
  severityBar: { severity: FailureSeverity; count: number; weight: number }[];
  moduleRiskHeatmap: { module: string; riskScore: number; failures: number }[];
  stabilityTrendLine: { label: string; stabilityScore: number }[];
  failedTestsTable: Array<{
    bugName: string;
    jiraId?: string;
    module: string;
    severity: FailureSeverity;
    failureType: string;
    errorMessage?: string;
  }>;
}

export interface PdfLayoutSpec {
  theme: "enterprise-light";
  coverAccent: string;
  sections: string[];
  fontFamily: string;
  pageSize: "A4";
}

export interface ExecutionReportOutput {
  pdfTitle: string;
  executiveSummary: ExecutiveSummary;
  executionOverview: ExecutionOverview;
  severityAnalysis: SeverityAnalysis;
  moduleRiskAnalysis: { modules: ModuleRiskRow[]; summary: string };
  businessFlowImpact: { flows: BusinessFlowRow[]; summary: string };
  /** Alias for PDF / Copilot consumers */
  businessFlowAnalysis: { flows: BusinessFlowRow[]; summary: string };
  flakyInsights: FlakyInsights;
  releaseReadiness: ReleaseReadiness;
  rootCauseInsights: RootCauseInsight[];
  rootCauseAnalysis: RootCauseInsight[];
  recommendations: string[];
  chartData: ChartDataSet;
  pdfLayoutSpec: PdfLayoutSpec;
  generatedAt: string;
  /** 12-section AI Executive QA Intelligence Report (Gosi Brain or deterministic) */
  executiveIntelligence?: ExecutiveIntelligenceSection;
}
