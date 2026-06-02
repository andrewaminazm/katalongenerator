import type { ExecutionReportOutput } from "./types.js";
import type { ExecutionReportPdfType } from "./executionReportPdfTypes.js";
import { renderPieChart, renderSeverityBars, renderHeatmap } from "./executionReportHtmlCharts.js";
import { esc, kpiCard, statusClass, sevClass } from "./executionReportHtmlShared.js";

function clusterByModule(report: ExecutionReportOutput) {
  const map = new Map<string, typeof report.chartData.failedTestsTable>();
  for (const row of report.chartData.failedTestsTable) {
    const mod = row.module || "General";
    const list = map.get(mod) ?? [];
    list.push(row);
    map.set(mod, list);
  }
  return [...map.entries()]
    .map(([module, tests]) => ({ module, count: tests.length, tests }))
    .sort((a, b) => b.count - a.count);
}

function executiveMarkdownToHtml(markdown: string): string {
  const chunks = markdown.split(/^## /m).filter(Boolean);
  if (chunks.length <= 1 && !markdown.includes("SECTION")) {
    return `<section class="section"><pre class="exec-section">${esc(markdown)}</pre></section>`;
  }
  return chunks
    .map((chunk) => {
      const nl = chunk.indexOf("\n");
      const title = nl === -1 ? chunk.trim() : chunk.slice(0, nl).trim();
      const body = nl === -1 ? "" : chunk.slice(nl + 1).trim();
      return `<div class="exec-section"><h3>${esc(title)}</h3><pre>${esc(body)}</pre></div>`;
    })
    .join("");
}

function summaryKpis(report: ExecutionReportOutput): string {
  const es = report.executiveSummary;
  const ov = report.executionOverview;
  const rr = report.releaseReadiness;
  return `<div class="kpi-row">
    ${kpiCard("Pass rate", `${es.passRatePercent}%`)}
    ${kpiCard("Stability", `${ov.stabilityScore}/100`)}
    ${kpiCard("Risk", `${ov.riskScore}/100`)}
    ${kpiCard("Readiness", `${rr.score}/100`, rr.status, `highlight ${statusClass(rr.status)}`)}
  </div>`;
}

function deploymentCallout(report: ExecutionReportOutput): string {
  const dep = report.executiveIntelligence?.deploymentRecommendation;
  if (!dep) return "";
  return `<div class="callout-danger">
    <span class="muted">Deployment recommendation</span>
    <div class="decision">${esc(dep.decision)}</div>
    <p>${esc(dep.reasoning)}</p>
    <p class="muted">Confidence: ${dep.confidencePercent}%</p>
    ${
      dep.requiredActions.length
        ? `<ul>${dep.requiredActions.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>`
        : ""
    }
  </div>`;
}

export function renderReportBody(report: ExecutionReportOutput, reportType: ExecutionReportPdfType): string {
  switch (reportType) {
    case "dashboard":
      return renderDashboardBody(report);
    case "severity":
      return renderSeverityBody(report);
    case "failures":
      return renderFailuresBody(report);
    case "modules":
      return renderModulesBody(report);
    case "flows":
      return renderFlowsBody(report);
    case "flaky":
      return renderFlakyBody(report);
    case "rootCause":
      return renderRootCauseBody(report);
    case "actionPlan":
      return renderActionPlanBody(report);
    case "release":
      return renderReleaseBody(report);
    case "executive":
      return renderExecutiveBody(report);
    case "execution":
    default:
      return renderExecutionBody(report);
  }
}

function renderExecutionBody(report: ExecutionReportOutput): string {
  const es = report.executiveSummary;
  const ov = report.executionOverview;
  const rr = report.releaseReadiness;
  return `
  <section class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="callout"><strong>${esc(es.releaseStatement)}</strong></div>
    ${summaryKpis(report)}
    <p><span class="badge ${statusClass(rr.status)}">${esc(rr.status)}</span> &nbsp;
    Duration: ${esc(es.duration)} · ${es.passed} passed / ${es.failed} failed / ${es.skipped} skipped</p>
    <p class="muted">${esc(ov.ciSummary)}</p>
  </section>
  <section class="section">
    <h2 class="section-title">Quality Dashboard</h2>
    <div class="charts-row">
      <div class="chart-box"><h4>Pass vs fail</h4>${renderPieChart(report.chartData.passFailPie)}</div>
      <div class="chart-box"><h4>Severity</h4>${renderSeverityBars(report.chartData.severityBar)}</div>
    </div>
  </section>
  ${renderRootCauseBody(report)}
  ${renderRecommendationsSection(report)}`;
}

function renderDashboardBody(report: ExecutionReportOutput): string {
  const es = report.executiveSummary;
  return `
  <section class="section">
    <h2 class="section-title">Quality Dashboard</h2>
    <p class="lead">Pass rate ${es.passRatePercent}% across ${es.totalTestCases} tests.</p>
    ${summaryKpis(report)}
    <div class="charts-row">
      <div class="chart-box"><h4>Pass vs fail distribution</h4>${renderPieChart(report.chartData.passFailPie)}</div>
      <div class="chart-box"><h4>Failure severity</h4>${renderSeverityBars(report.chartData.severityBar)}</div>
    </div>
    <h4 style="margin:16px 0 8px;font-size:10pt;color:#475569">Module risk heatmap</h4>
    ${renderHeatmap(report.chartData.moduleRiskHeatmap)}
  </section>`;
}

function renderSeverityBody(report: ExecutionReportOutput): string {
  const sev = report.executiveSummary.severityCounts;
  const crit = report.severityAnalysis.criticalFailures
    .map(
      (c) => `<tr>
        <td>${esc(c.bugName)}</td>
        <td>${esc(c.jiraId ?? "")}</td>
        <td>${esc(c.module)}</td>
        <td><span class="pill ${sevClass(c.severity)}">${esc(c.severity)}</span></td>
        <td class="err-msg">${esc(c.errorMessage ?? "")}</td>
      </tr>`
    )
    .join("");

  const topMod = report.severityAnalysis.topFailingModules
    .map(
      (m) =>
        `<tr><td>${esc(m.module)}</td><td>${m.count}</td><td><span class="pill ${sevClass(m.maxSeverity)}">${esc(m.maxSeverity)}</span></td></tr>`
    )
    .join("");

  return `
  <section class="section">
    <h2 class="section-title">Severity Overview</h2>
    ${summaryKpis(report)}
    <p>Weighted risk points: <strong>${report.severityAnalysis.weightedRiskPoints}</strong></p>
    <table class="data">
      <thead><tr><th>Severity</th><th>Count</th></tr></thead>
      <tbody>
        <tr><td class="sev-critical">CRITICAL</td><td>${sev.CRITICAL}</td></tr>
        <tr><td class="sev-high">HIGH</td><td>${sev.HIGH}</td></tr>
        <tr><td class="sev-medium">MEDIUM</td><td>${sev.MEDIUM}</td></tr>
        <tr><td class="sev-low">LOW</td><td>${sev.LOW}</td></tr>
      </tbody>
    </table>
    ${
      topMod
        ? `<h4 style="margin:16px 0 8px">Top failing modules</h4>
        <table class="data"><thead><tr><th>Module</th><th>Failures</th><th>Max</th></tr></thead><tbody>${topMod}</tbody></table>`
        : ""
    }
    ${
      crit
        ? `<h4 style="margin:16px 0 8px">Critical &amp; high failures</h4>
        <table class="data"><thead><tr><th>Bug</th><th>Jira</th><th>Module</th><th>Severity</th><th>Error</th></tr></thead><tbody>${crit}</tbody></table>`
        : '<p class="muted">No critical failures in this snapshot.</p>'
    }
  </section>`;
}

function renderFailuresBody(report: ExecutionReportOutput): string {
  const clusters = clusterByModule(report);
  const cards = clusters
    .map(
      (c) => `<div class="cluster-card">
        <h4>${esc(c.module)} — ${c.count} failure(s)</h4>
        <p class="muted">Impact: ${c.count >= 3 ? "High" : c.count >= 2 ? "Medium" : "Low"}</p>
        <ul>${c.tests
          .map(
            (t) =>
              `<li><strong>${esc(t.bugName)}</strong> (${esc(t.severity)})${t.jiraId ? ` — Jira: ${esc(t.jiraId)}` : ""}${t.errorMessage ? ` — ${esc(t.errorMessage.slice(0, 100))}` : ""}</li>`
          )
          .join("")}</ul>
      </div>`
    )
    .join("");
  return `
  <section class="section">
    <h2 class="section-title">Failure Intelligence</h2>
    <p class="lead">Failures clustered by module — business impact view.</p>
    ${cards || '<p class="muted">No failures recorded.</p>'}
  </section>`;
}

function renderModulesBody(report: ExecutionReportOutput): string {
  const rows = [...report.moduleRiskAnalysis.modules]
    .sort((a, b) => a.riskScore - b.riskScore)
    .map(
      (m) => `<tr>
        <td>${esc(m.module)}</td>
        <td>${Math.max(0, 100 - m.riskScore)}</td>
        <td>${m.failureCount}</td>
        <td>${m.stabilityScore}</td>
        <td class="risk-pill">${m.riskScore}</td>
        <td>${esc(m.dominantFailureType)}</td>
      </tr>`
    )
    .join("");
  return `
  <section class="section">
    <h2 class="section-title">Module Health Dashboard</h2>
    <p class="lead">${esc(report.moduleRiskAnalysis.summary)}</p>
    ${
      rows
        ? `<table class="data">
        <thead><tr><th>Module</th><th>Quality</th><th>Failures</th><th>Stability</th><th>Risk</th><th>Type</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="muted">Sorted healthiest → riskiest.</p>`
        : '<p class="muted">No module failures.</p>'
    }
  </section>`;
}

function renderFlowsBody(report: ExecutionReportOutput): string {
  const flowRows = report.businessFlowImpact.flows
    .map(
      (f) => `<tr>
        <td>${esc(f.flowName)}</td>
        <td>${f.passRatePercent}%</td>
        <td>${f.riskScore}</td>
        <td>${esc(f.impact.slice(0, 120))}</td>
      </tr>`
    )
    .join("");
  return `
  <section class="section">
    <h2 class="section-title">Business Flow Impact</h2>
    <p class="lead">${esc(report.businessFlowImpact.summary)}</p>
    ${
      flowRows
        ? `<table class="data"><thead><tr><th>Flow</th><th>Pass est.</th><th>Risk</th><th>Impact</th></tr></thead><tbody>${flowRows}</tbody></table>`
        : '<p class="muted">No business flow signals.</p>'
    }
  </section>`;
}

function renderFlakyBody(report: ExecutionReportOutput): string {
  const f = report.flakyInsights;
  return `
  <section class="section">
    <h2 class="section-title">Flaky Test Intelligence</h2>
    <p class="lead">Stability trend: <strong>${esc(f.stabilityTrend)}</strong></p>
    ${
      f.flakyCandidates.length
        ? `<h4>Flaky candidates</h4><ul>${f.flakyCandidates.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`
        : ""
    }
    ${
      f.repeatedFailureSignals.length
        ? `<h4>Repeated signals</h4><ul>${f.repeatedFailureSignals.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
        : ""
    }
    ${
      f.regressionSignals.length
        ? `<h4>Regression signals</h4><ul>${f.regressionSignals.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
        : ""
    }
  </section>`;
}

function renderRootCauseBody(report: ExecutionReportOutput): string {
  const html = report.rootCauseInsights
    .map(
      (r) => `<div class="insight-card">
        <strong>${esc(r.category)}</strong>
        <span class="likelihood">${esc(r.likelihood)} likelihood</span>
        <p>${esc(r.summary)}</p>
      </div>`
    )
    .join("");
  return `
  <section class="section">
    <h2 class="section-title">Root Cause Analysis</h2>
    ${html || '<p class="muted">No root-cause categories identified.</p>'}
  </section>`;
}

function renderRecommendationsSection(report: ExecutionReportOutput): string {
  const recs = report.recommendations
    .map((r, i) => `<li><span class="rec-num">${i + 1}</span>${esc(r)}</li>`)
    .join("");
  return `
  <section class="section">
    <h2 class="section-title">Recommendations</h2>
    <ul class="rec-list">${recs || "<li>No recommendations.</li>"}</ul>
  </section>`;
}

function renderActionPlanBody(report: ExecutionReportOutput): string {
  const es = report.executiveSummary;
  const rr = report.releaseReadiness;
  const critical = es.severityCounts.CRITICAL;
  const p0 = [
    ...(critical > 0 ? [`Resolve ${critical} CRITICAL failure(s) before production`] : []),
    ...rr.blockingIssues,
  ];
  const p1 = report.recommendations;
  return `
  <section class="section">
    <h2 class="section-title">Engineering Action Plan</h2>
    <div class="action-p0">
      <h4>P0 — Release blockers</h4>
      <ul>${p0.length ? p0.map((x) => `<li>${esc(x)}</li>`).join("") : "<li>None identified.</li>"}</ul>
    </div>
    <h4>P1 — Critical improvements</h4>
    <ul>${p1.length ? p1.map((x) => `<li>${esc(x)}</li>`).join("") : "<li>Maintain monitoring.</li>"}</ul>
    <h4 style="margin-top:16px">P2 — High value</h4>
    <ul>
      <li>Stabilize top failing module automation</li>
      <li>Add API contract checks where API failures exist</li>
    </ul>
  </section>`;
}

function renderReleaseBody(report: ExecutionReportOutput): string {
  const rr = report.releaseReadiness;
  const intel = report.executiveIntelligence;
  const blocking =
    rr.blockingIssues.length > 0
      ? `<ul class="block-list">${rr.blockingIssues.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
      : '<p class="muted">No blocking issues.</p>';

  return `
  <section class="section">
    <h2 class="section-title">Release Readiness</h2>
    <div class="callout"><strong>${esc(report.executiveSummary.releaseStatement)}</strong></div>
    ${summaryKpis(report)}
    ${deploymentCallout(report)}
    <p>QA Director status: <strong>${esc(intel?.directorStatus ?? rr.status)}</strong></p>
    <h4 style="margin:12px 0 8px">Blocking issues</h4>
    ${blocking}
    <h4 style="margin:12px 0 8px">Scoring factors</h4>
    <ul>${rr.factors.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
  </section>
  ${renderRecommendationsSection(report)}`;
}

function renderExecutiveBody(report: ExecutionReportOutput): string {
  const intel = report.executiveIntelligence;
  if (!intel) {
    return `
    <section class="section">
      <h2 class="section-title">Executive QA Intelligence</h2>
      <p class="muted">Executive narrative was not generated. Regenerate with Executive report type selected.</p>
      ${renderReleaseBody(report)}
    </section>`;
  }
  return `
  <section class="section">
    <h2 class="section-title">Director Assessment</h2>
    <p>Status: <span class="badge ${intel.directorStatus === "READY" ? "badge-ready" : intel.directorStatus === "AT RISK" ? "badge-risk" : "badge-blocked"}">${esc(intel.directorStatus)}</span>
    · Source: ${esc(intel.generatedBy)}${intel.model ? ` (${esc(intel.model)})` : ""}</p>
    ${deploymentCallout(report)}
  </section>
  <section class="section">
    <h2 class="section-title">Full Executive Report</h2>
    ${executiveMarkdownToHtml(intel.markdown)}
  </section>`;
}
