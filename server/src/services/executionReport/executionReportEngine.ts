import { analyzeBusinessFlowImpact } from "./businessFlowImpact.js";
import { buildChartData } from "./chartDataBuilder.js";
import { buildFlakyInsights, buildRecommendations, buildRootCauseInsights } from "./insightsEngine.js";
import { analyzeModuleRisk } from "./moduleRiskAnalyzer.js";
import {
  computeReleaseReadiness,
  computeRiskScore,
  computeStabilityScore,
  countCriticalPathFailures,
  passRatePercent,
} from "./scoringEngine.js";
import {
  countBySeverity,
  enrichFailedTests,
  weightedRiskPoints,
} from "./severityEngine.js";
import type { ExecutionReportInput, ExecutionReportOutput, ReleaseStatus } from "./types.js";

function validateInput(input: ExecutionReportInput): void {
  if (!input.projectName?.trim()) throw new Error("projectName is required");
  if (!input.buildId?.trim()) throw new Error("buildId is required");
  const ex = input.testExecution;
  if (!ex || ex.totalTestCases < 0) throw new Error("testExecution.totalTestCases is required");
  const sum = ex.passed + ex.failed + ex.skipped;
  if (sum > ex.totalTestCases + 1) {
    throw new Error("passed + failed + skipped cannot exceed totalTestCases");
  }
}

export function generateExecutionReport(input: ExecutionReportInput): ExecutionReportOutput {
  validateInput(input);

  const enriched = enrichFailedTests(input.failedTests ?? []);
  const severityCounts = countBySeverity(enriched);
  const passRate = passRatePercent(input.testExecution);
  const stabilityScore = computeStabilityScore(input.testExecution, severityCounts);
  const riskScore = computeRiskScore(input.testExecution, enriched);
  const criticalPath = countCriticalPathFailures(enriched);
  const release = computeReleaseReadiness(input.testExecution, severityCounts, criticalPath);

  const moduleRows = analyzeModuleRisk(enriched);
  const flows = analyzeBusinessFlowImpact(input.testExecution, enriched);
  const flaky = buildFlakyInsights(enriched);
  const rootCauses = buildRootCauseInsights(enriched);
  const recommendations = buildRecommendations(
    release.status,
    moduleRows,
    flaky,
    severityCounts.CRITICAL
  );

  const topModules = moduleRows.slice(0, 8).map((m) => ({
    module: m.module,
    count: m.failureCount,
    maxSeverity:
      enriched.find((t) => t.module === m.module)?.failureSeverity ?? ("LOW" as const),
  }));

  const criticalFailures = enriched
    .filter((t) => t.failureSeverity === "CRITICAL" || t.failureSeverity === "HIGH")
    .slice(0, 15)
    .map((t) => ({
      bugName: t.bugName ?? t.testCaseName ?? "Unnamed bug",
      jiraId: t.jiraId,
      module: t.module,
      errorMessage: t.errorMessage,
      severity: t.failureSeverity,
    }));

  const releaseStatement = buildReleaseStatement(passRate, release.status, severityCounts, moduleRows[0]?.module);

  const chartData = buildChartData(
    input.testExecution,
    severityCounts,
    moduleRows,
    stabilityScore,
    enriched
  );

  const pdfTitle = `Katalon Execution Intelligence Report — ${input.projectName}`;
  const businessFlowImpact = {
    flows,
    summary:
      flows.some((f) => f.riskScore >= 40)
        ? "One or more business-critical flows show elevated risk — review before release."
        : "Business flows show acceptable risk for this execution snapshot.",
  };

  return {
    pdfTitle,
    executiveSummary: {
      headline: `${input.projectName} — Build ${input.buildId}`,
      totalTestCases: input.testExecution.totalTestCases,
      passed: input.testExecution.passed,
      failed: input.testExecution.failed,
      skipped: input.testExecution.skipped,
      passRatePercent: passRate,
      duration: input.testExecution.duration,
      severityCounts,
      releaseStatement,
      releaseStatus: release.status,
    },
    executionOverview: {
      stabilityScore,
      riskScore,
      environment: input.environment,
      buildId: input.buildId,
      executionDate: input.executionDate,
      ciSummary: [
        input.pipelineName ? `Pipeline: ${input.pipelineName}` : null,
        input.branch ? `Branch: ${input.branch}` : null,
        input.triggeredBy ? `Triggered by: ${input.triggeredBy}` : null,
        `Duration: ${input.testExecution.duration}`,
      ]
        .filter(Boolean)
        .join(" · ") || "CI metadata not provided",
    },
    severityAnalysis: {
      breakdown: severityCounts,
      weightedRiskPoints: weightedRiskPoints(enriched),
      topFailingModules: topModules,
      criticalFailures,
    },
    moduleRiskAnalysis: {
      modules: moduleRows,
      summary:
        moduleRows.length > 0
          ? `Highest risk module: **${moduleRows[0]!.module}** (score ${moduleRows[0]!.riskScore}).`
          : "No module-level failures in this run.",
    },
    businessFlowImpact,
    businessFlowAnalysis: businessFlowImpact,
    flakyInsights: flaky,
    releaseReadiness: release,
    rootCauseInsights: rootCauses,
    rootCauseAnalysis: rootCauses,
    recommendations,
    chartData,
    pdfLayoutSpec: {
      theme: "enterprise-light",
      coverAccent: "#1e3a5f",
      sections: [
        "cover",
        "executiveSummary",
        "executionOverview",
        "severityAnalysis",
        "moduleRisk",
        "businessFlow",
        "flakyInsights",
        "releaseReadiness",
        "rootCause",
        "recommendations",
      ],
      fontFamily: "system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      pageSize: "A4",
    },
    generatedAt: new Date().toISOString(),
  };
}

function buildReleaseStatement(
  passRate: number,
  status: ReleaseStatus,
  severity: Record<string, number>,
  topModule?: string
): string {
  const parts = [`Execution shows ${passRate}% pass rate.`];
  if (severity.CRITICAL > 0) {
    parts.push(
      `${severity.CRITICAL} critical failure(s)${topModule ? ` concentrated in ${topModule}` : ""} block release readiness.`
    );
  } else if (status === "AT_RISK") {
    parts.push("Elevated severity failures warrant stabilization before production release.");
  } else if (status === "READY") {
    parts.push("No blocking severity pattern detected for this snapshot.");
  } else {
    parts.push("Release is blocked until critical issues are resolved.");
  }
  return parts.join(" ");
}
