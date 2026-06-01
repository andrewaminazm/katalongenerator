import type { ExecutionReportInput, ExecutionReportOutput } from "./types.js";

/** Deterministic facts for Executive QA Intelligence — LLM must not contradict these. */
export function buildExecutionIntelligenceEvidence(
  input: ExecutionReportInput,
  report: ExecutionReportOutput
): string {
  const es = report.executiveSummary;
  const eo = report.executionOverview;
  const rr = report.releaseReadiness;
  const sev = es.severityCounts;

  const lines: string[] = [
    "## EVIDENCE PACK — Execution Intelligence (authoritative)",
    "",
    "### Execution snapshot (source: user input + scoring engine)",
    `- Project: ${input.projectName}`,
    `- Build: ${input.buildId}`,
    `- Date: ${input.executionDate}`,
    `- Environment: ${input.environment}`,
    `- Total tests: ${es.totalTestCases}`,
    `- Passed / Failed / Skipped: ${es.passed} / ${es.failed} / ${es.skipped}`,
    `- Pass rate: ${es.passRatePercent}% (source: scoring engine)`,
    `- Duration: ${es.duration}`,
    `- Stability score: ${eo.stabilityScore}/100 (source: scoring engine)`,
    `- Risk score: ${eo.riskScore}/100 (source: scoring engine)`,
    `- Release readiness: ${rr.status} — score ${rr.score}/100 — confidence ${rr.confidencePercent}% (source: scoring engine)`,
    `- Release statement: ${es.releaseStatement}`,
    "",
    "### Severity (source: scoring engine)",
    `- CRITICAL: ${sev.CRITICAL ?? 0}`,
    `- HIGH: ${sev.HIGH ?? 0}`,
    `- MEDIUM: ${sev.MEDIUM ?? 0}`,
    `- LOW: ${sev.LOW ?? 0}`,
    `- Weighted risk points: ${report.severityAnalysis.weightedRiskPoints}`,
    "",
    "### Module risk rows (source: module risk analyzer)",
  ];

  for (const m of report.moduleRiskAnalysis.modules.slice(0, 20)) {
    lines.push(
      `- ${m.module}: failures=${m.failureCount}, risk=${m.riskScore}, stability=${m.stabilityScore}, dominant=${m.dominantFailureType}`
    );
  }
  if (report.moduleRiskAnalysis.modules.length === 0) {
    lines.push("- No module failures recorded.");
  }

  lines.push("", "### Failure clusters by module (source: failed test input)");
  const byModule = new Map<string, number>();
  for (const t of input.failedTests ?? []) {
    byModule.set(t.module, (byModule.get(t.module) ?? 0) + 1);
  }
  for (const [mod, count] of [...byModule.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`- ${mod}: ${count} failure(s)`);
  }

  lines.push("", "### Root cause insights (source: insights engine)");
  for (const r of report.rootCauseInsights) {
    lines.push(`- ${r.category} (${r.likelihood}): ${r.summary}`);
  }

  lines.push("", "### Flaky insights (source: insights engine)");
  lines.push(`- Stability trend: ${report.flakyInsights.stabilityTrend}`);
  if (report.flakyInsights.flakyCandidates.length) {
    lines.push(`- Flaky candidates: ${report.flakyInsights.flakyCandidates.join("; ")}`);
  }
  if (report.flakyInsights.repeatedFailureSignals.length) {
    lines.push(`- Repeated signals: ${report.flakyInsights.repeatedFailureSignals.join("; ")}`);
  }

  lines.push("", "### Business flows (source: business flow impact)");
  lines.push(`- ${report.businessFlowImpact.summary}`);
  for (const f of report.businessFlowImpact.flows) {
    lines.push(`- ${f.flowName}: risk=${f.riskScore}, passRateEst=${f.passRatePercent ?? "n/a"}%`);
  }

  lines.push("", "### Blocking issues (source: release readiness)");
  if (rr.blockingIssues.length === 0) lines.push("- None listed.");
  else for (const b of rr.blockingIssues) lines.push(`- ${b}`);

  lines.push("", "### Recommendations (source: insights engine)");
  for (const rec of report.recommendations) lines.push(`- ${rec}`);

  lines.push(
    "",
    "### Historical trend",
    "No prior execution snapshots in this request — Section 7 must state historical trend data unavailable unless conversation memory provides prior runs.",
    "",
    "### Coverage / assertion quality",
    "No project coverage analyzer run in this request — Coverage and Assertion Quality scores must be Unknown unless user attached project coverage separately."
  );

  return lines.join("\n");
}
