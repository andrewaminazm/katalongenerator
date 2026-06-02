import type { ExecutionReportOutput } from "../../api";

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

export interface FlakyInsightsData {
  repeatedFailureSignals: string[];
  flakyCandidates: string[];
  stabilityTrend: string;
  regressionSignals: string[];
}

export interface SeverityAnalysisData {
  weightedRiskPoints: number;
  topFailingModules: Array<{ module: string; count: number; maxSeverity: string }>;
  criticalFailures: Array<{
    bugName: string;
    jiraId?: string;
    module: string;
    errorMessage?: string;
    severity: string;
  }>;
}

export interface ChartDataParsed {
  passFailPie: Array<{ label: string; value: number }>;
  severityBar: Array<{ severity: string; count: number; weight: number }>;
  moduleRiskHeatmap: Array<{ module: string; riskScore: number; failures: number }>;
  failedTestsTable: Array<{
    bugName: string;
    jiraId?: string;
    module: string;
    severity: string;
    failureType: string;
    errorMessage?: string;
  }>;
}

export function getModuleRows(report: ExecutionReportOutput): ModuleRiskRow[] {
  const raw = report.moduleRiskAnalysis as { modules?: ModuleRiskRow[] };
  return raw?.modules ?? [];
}

export function getBusinessFlows(report: ExecutionReportOutput): BusinessFlowRow[] {
  const flows = report.businessFlowAnalysis?.flows ?? report.businessFlowImpact?.flows ?? [];
  return flows as BusinessFlowRow[];
}

export function getFlakyInsights(report: ExecutionReportOutput): FlakyInsightsData {
  const f = report.flakyInsights as Partial<FlakyInsightsData>;
  return {
    repeatedFailureSignals: f.repeatedFailureSignals ?? [],
    flakyCandidates: f.flakyCandidates ?? [],
    stabilityTrend: f.stabilityTrend ?? "unknown",
    regressionSignals: f.regressionSignals ?? [],
  };
}

export function getSeverityAnalysis(report: ExecutionReportOutput): SeverityAnalysisData {
  const s = report.severityAnalysis as Partial<SeverityAnalysisData>;
  return {
    weightedRiskPoints: s.weightedRiskPoints ?? 0,
    topFailingModules: s.topFailingModules ?? [],
    criticalFailures: s.criticalFailures ?? [],
  };
}

export function getChartData(report: ExecutionReportOutput): ChartDataParsed {
  const c = report.chartData as Partial<ChartDataParsed>;
  return {
    passFailPie: c.passFailPie ?? [],
    severityBar: c.severityBar ?? [],
    moduleRiskHeatmap: c.moduleRiskHeatmap ?? [],
    failedTestsTable: c.failedTestsTable ?? [],
  };
}

/** Cluster failures by module for Failure Intelligence view */
export function clusterFailuresByModule(
  table: ChartDataParsed["failedTestsTable"]
): Array<{ module: string; count: number; tests: typeof table }> {
  const map = new Map<string, typeof table>();
  for (const row of table) {
    const mod = row.module || "General";
    const list = map.get(mod) ?? [];
    list.push(row);
    map.set(mod, list);
  }
  return [...map.entries()]
    .map(([module, tests]) => ({ module, count: tests.length, tests }))
    .sort((a, b) => b.count - a.count);
}
