import type { ExecutionReportOutput } from "./types.js";

function statusBadge(status: string): string {
  if (status === "BLOCKED") return "**BLOCKED**";
  if (status === "AT_RISK") return "**AT RISK**";
  return "**READY**";
}

export function reportToMarkdown(report: ExecutionReportOutput): string {
  const es = report.executiveSummary;
  const rr = report.releaseReadiness;

  const lines: string[] = [
    `# Katalon Execution Intelligence Report`,
    "",
    `**${report.pdfTitle}**`,
    "",
    "---",
    "",
    "## Cover",
    "",
    `| | |`,
    `|---|---|`,
    `| **Project** | ${es.headline.split("—")[0]?.trim() || report.pdfTitle} |`,
    `| **Build** | ${report.executionOverview.buildId} |`,
    `| **Date** | ${report.executionOverview.executionDate} |`,
    `| **Environment** | ${report.executionOverview.environment} |`,
    "",
    "---",
    "",
    "## 1. Executive Summary",
    "",
    es.headline,
    "",
    `- **Total tests:** ${es.totalTestCases}`,
    `- **Passed / Failed / Skipped:** ${es.passed} / ${es.failed} / ${es.skipped}`,
    `- **Pass rate:** ${es.passRatePercent}%`,
    `- **Duration:** ${es.duration}`,
    `- **Release readiness:** ${statusBadge(rr.status)} (score ${rr.score}/100)`,
    "",
    es.releaseStatement,
    "",
    "### Severity summary",
    "",
    `| Severity | Count |`,
    `|----------|-------|`,
    `| CRITICAL | ${es.severityCounts.CRITICAL} |`,
    `| HIGH | ${es.severityCounts.HIGH} |`,
    `| MEDIUM | ${es.severityCounts.MEDIUM} |`,
    `| LOW | ${es.severityCounts.LOW} |`,
    "",
    "---",
    "",
    "## 2. Execution Overview",
    "",
    `- **Stability score:** ${report.executionOverview.stabilityScore}/100`,
    `- **Risk score:** ${report.executionOverview.riskScore}/100`,
    `- **CI summary:** ${report.executionOverview.ciSummary}`,
    "",
    "---",
    "",
    "## 3. Failure Severity Analysis",
    "",
    `Weighted risk points: **${report.severityAnalysis.weightedRiskPoints}**`,
    "",
    "### Top failing modules",
    "",
  ];

  if (report.severityAnalysis.topFailingModules.length === 0) {
    lines.push("_No failures recorded._", "");
  } else {
    lines.push("| Module | Failures | Max severity |", "|--------|----------|--------------|");
    for (const m of report.severityAnalysis.topFailingModules) {
      lines.push(`| ${m.module} | ${m.count} | ${m.maxSeverity} |`);
    }
    lines.push("");
  }

  if (report.severityAnalysis.criticalFailures.length > 0) {
    lines.push("### Critical failures", "");
    for (const c of report.severityAnalysis.criticalFailures) {
      const jira = c.jiraId ? ` — Jira: ${c.jiraId}` : "";
      const err = c.errorMessage ? ` — ${c.errorMessage.slice(0, 100)}` : "";
      lines.push(`- **${c.bugName}** (${c.module})${jira}${err}`);
    }
    lines.push("");
  }

  lines.push(
    "---",
    "",
    "## 4. Module Risk Analysis",
    "",
    report.moduleRiskAnalysis.summary,
    "",
    "| Module | Failures | Risk | Stability | Dominant type |",
    "|--------|----------|------|-----------|---------------|"
  );

  for (const m of report.moduleRiskAnalysis.modules.slice(0, 15)) {
    lines.push(
      `| ${m.module} | ${m.failureCount} | ${m.riskScore} | ${m.stabilityScore} | ${m.dominantFailureType} |`
    );
  }

  lines.push("", "---", "", "## 5. Business Flow Impact", "", report.businessFlowImpact.summary, "");

  for (const f of report.businessFlowImpact.flows) {
    lines.push(
      `### ${f.flowName}`,
      `- Pass rate (est.): ${f.passRatePercent}%`,
      `- Risk score: ${f.riskScore}`,
      `- ${f.impact}`,
      f.failedTests.length ? `- Failed: ${f.failedTests.join(", ")}` : "",
      ""
    );
  }

  lines.push(
    "---",
    "",
    "## 6. Flaky & Reliability Insights",
    "",
    `- **Trend:** ${report.flakyInsights.stabilityTrend}`,
    ""
  );

  if (report.flakyInsights.repeatedFailureSignals.length) {
    lines.push("**Repeated signals:**");
    for (const s of report.flakyInsights.repeatedFailureSignals) lines.push(`- ${s}`);
    lines.push("");
  }

  if (report.flakyInsights.flakyCandidates.length) {
    lines.push("**Flaky candidates:**", report.flakyInsights.flakyCandidates.map((f) => `- ${f}`).join("\n"), "");
  }

  lines.push(
    "---",
    "",
    "## 7. Release Readiness",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Score | ${rr.score}/100 |`,
    `| Status | ${rr.status} |`,
    `| Confidence | ${rr.confidencePercent}% |`,
    "",
    "### Blocking issues",
    ""
  );

  if (rr.blockingIssues.length === 0) lines.push("_None identified._", "");
  else for (const b of rr.blockingIssues) lines.push(`- ${b}`);

  lines.push("", "---", "", "## 8. AI Root Cause Insights", "");

  for (const r of report.rootCauseInsights) {
    lines.push(`- **${r.category}** (${r.likelihood}): ${r.summary}`);
  }

  lines.push("", "---", "", "## 9. Recommendations", "");
  for (const rec of report.recommendations) lines.push(`- ${rec}`);

  if (report.executiveIntelligence?.markdown) {
    lines.push(
      "",
      "---",
      "",
      report.executiveIntelligence.markdown,
      "",
      `*Executive intelligence generated by: ${report.executiveIntelligence.generatedBy}${report.executiveIntelligence.model ? ` (${report.executiveIntelligence.model})` : ""}*`,
      ""
    );
  }

  lines.push(
    "",
    "---",
    "",
    "## Chart data reference",
    "",
    "_Structured chart payloads are included in the JSON API response (`chartData`) for dashboard rendering._",
    "",
    `*Generated ${report.generatedAt}*`
  );

  return lines.join("\n");
}
