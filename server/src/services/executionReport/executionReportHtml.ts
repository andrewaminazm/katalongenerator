import type { ExecutionReportOutput, FailureSeverity } from "./types.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(status: string): string {
  if (status === "BLOCKED") return "badge-blocked";
  if (status === "AT_RISK") return "badge-risk";
  return "badge-ready";
}

function sevClass(sev: string): string {
  return `sev-${sev.toLowerCase()}`;
}

function renderPieChart(
  slices: { label: string; value: number }[],
  size = 140
): string {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const colors: Record<string, string> = {
    Passed: "#16a34a",
    Failed: "#dc2626",
    Skipped: "#94a3b8",
  };
  let angle = -90;
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;
  const paths: string[] = [];

  for (const slice of slices) {
    if (slice.value <= 0) continue;
    const sweep = (slice.value / total) * 360;
    const a0 = (angle * Math.PI) / 180;
    const a1 = ((angle + sweep) * Math.PI) / 180;
    const x0 = cx + r * Math.cos(a0);
    const y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1);
    const y1 = cy + r * Math.sin(a1);
    const large = sweep > 180 ? 1 : 0;
    paths.push(
      `<path d="M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z" fill="${colors[slice.label] ?? "#64748b"}" />`
    );
    angle += sweep;
  }

  const legend = slices
    .map(
      (s) =>
        `<span class="legend-item"><i style="background:${colors[s.label] ?? "#64748b"}"></i>${esc(s.label)} ${s.value}</span>`
    )
    .join("");

  return `<div class="chart-pie-wrap">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Pass fail chart">${paths.join("")}</svg>
    <div class="chart-legend">${legend}</div>
  </div>`;
}

function renderSeverityBars(
  bars: { severity: FailureSeverity; count: number; weight: number }[]
): string {
  const max = Math.max(1, ...bars.map((b) => b.count));
  const colors: Record<string, string> = {
    CRITICAL: "#dc2626",
    HIGH: "#ea580c",
    MEDIUM: "#ca8a04",
    LOW: "#16a34a",
  };
  const rows = bars
    .map((b) => {
      const w = Math.round((b.count / max) * 100);
      return `<div class="bar-row">
        <span class="bar-label ${sevClass(b.severity)}">${b.severity}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${colors[b.severity]}"></div></div>
        <span class="bar-val">${b.count}</span>
      </div>`;
    })
    .join("");
  return `<div class="chart-bars">${rows}</div>`;
}

function renderHeatmap(
  cells: { module: string; riskScore: number; failures: number }[]
): string {
  if (cells.length === 0) return "<p class=\"muted\">No module risk data.</p>";
  return `<div class="heatmap">${cells
    .slice(0, 10)
    .map((c) => {
      const intensity = Math.min(1, c.riskScore / 100);
      const bg = `rgba(220, 38, 38, ${0.15 + intensity * 0.55})`;
      return `<div class="heat-cell" style="background:${bg}">
        <strong>${esc(c.module)}</strong>
        <span>Risk ${c.riskScore} · ${c.failures} fail</span>
      </div>`;
    })
    .join("")}</div>`;
}

function kpiCard(label: string, value: string, sub?: string, extraClass = ""): string {
  return `<div class="kpi ${extraClass}">
    <span class="kpi-label">${esc(label)}</span>
    <strong class="kpi-value">${esc(value)}</strong>
    ${sub ? `<span class="kpi-sub">${esc(sub)}</span>` : ""}
  </div>`;
}

export function renderExecutionReportHtml(report: ExecutionReportOutput): string {
  const es = report.executiveSummary;
  const ov = report.executionOverview;
  const rr = report.releaseReadiness;
  const projectName = es.headline.split("—")[0]?.trim() || report.pdfTitle;

  const failedTableRows = report.chartData.failedTestsTable
    .map(
      (r) => `<tr>
        <td>${esc(r.testCaseName)}</td>
        <td>${esc(r.module)}</td>
        <td><span class="pill ${sevClass(r.severity)}">${esc(r.severity)}</span></td>
        <td>${esc(r.failureType)}</td>
        <td class="err-msg">${esc(r.errorMessage)}</td>
      </tr>`
    )
    .join("");

  const moduleRows = report.moduleRiskAnalysis.modules
    .slice(0, 12)
    .map(
      (m) => `<tr>
        <td>${esc(m.module)}</td>
        <td>${m.failureCount}</td>
        <td><span class="risk-pill">${m.riskScore}</span></td>
        <td>${m.stabilityScore}</td>
        <td>${esc(m.dominantFailureType)}</td>
      </tr>`
    )
    .join("");

  const flowRows = report.businessFlowImpact.flows
    .map(
      (f) => `<tr>
        <td>${esc(f.flowName)}</td>
        <td>${f.passRatePercent}%</td>
        <td>${f.riskScore}</td>
        <td>${esc(f.impact.slice(0, 80))}</td>
      </tr>`
    )
    .join("");

  const blockingList =
    rr.blockingIssues.length > 0
      ? `<ul class="block-list">${rr.blockingIssues.map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
      : "<p class=\"muted\">No blocking issues identified.</p>";

  const rootCauseHtml = report.rootCauseInsights
    .map(
      (r) => `<div class="insight-card">
        <strong>${esc(r.category)}</strong>
        <span class="likelihood">${esc(r.likelihood)} likelihood</span>
        <p>${esc(r.summary)}</p>
      </div>`
    )
    .join("");

  const recsHtml = report.recommendations
    .map((r, i) => `<li><span class="rec-num">${i + 1}</span>${esc(r)}</li>`)
    .join("");

  const generated = new Date(report.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(report.pdfTitle)}</title>
  <style>
    @page { size: A4; margin: 14mm 16mm 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif;
      font-size: 10.5pt;
      color: #0f172a;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cover {
      page-break-after: always;
      min-height: 240mm;
      padding: 48px 40px;
      background: linear-gradient(145deg, #0f2744 0%, #1e3a5f 45%, #1e40af 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cover-brand { font-size: 11pt; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.85; }
    .cover h1 { font-size: 32pt; font-weight: 700; margin: 24px 0 8px; line-height: 1.15; letter-spacing: -0.02em; }
    .cover .subtitle { font-size: 14pt; opacity: 0.9; margin: 0 0 32px; }
    .cover-meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-top: auto; }
    .cover-meta dt { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.08em; opacity: 0.7; margin: 0 0 4px; }
    .cover-meta dd { font-size: 12pt; font-weight: 600; margin: 0; }
    .cover-footer { font-size: 9pt; opacity: 0.65; margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 16px; }
    .section { padding: 0 4px 20px; page-break-inside: avoid; }
    .section-title {
      font-size: 14pt;
      font-weight: 700;
      color: #1e3a5f;
      margin: 28px 0 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
    }
    .section-title:first-of-type { margin-top: 8px; }
    .lead { font-size: 11pt; color: #334155; margin: 0 0 16px; }
    .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
    .kpi {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
    }
    .kpi-label { display: block; font-size: 8.5pt; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi-value { display: block; font-size: 18pt; font-weight: 700; color: #0f172a; margin-top: 4px; }
    .kpi-sub { font-size: 8.5pt; color: #64748b; }
    .kpi.highlight { background: #eff6ff; border-color: #bfdbfe; }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 10pt;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .badge-blocked { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-risk { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .badge-ready { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 16px 0; align-items: start; }
    .chart-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
    .chart-box h4 { margin: 0 0 12px; font-size: 10pt; color: #475569; }
    .chart-pie-wrap { display: flex; align-items: center; gap: 16px; }
    .chart-legend { display: flex; flex-direction: column; gap: 6px; font-size: 9.5pt; }
    .legend-item { display: flex; align-items: center; gap: 8px; }
    .legend-item i { width: 10px; height: 10px; border-radius: 2px; display: inline-block; }
    .bar-row { display: grid; grid-template-columns: 72px 1fr 28px; gap: 8px; align-items: center; margin-bottom: 8px; font-size: 9pt; }
    .bar-track { height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 5px; }
    .bar-val { text-align: right; font-weight: 600; }
    .sev-critical { color: #dc2626; font-weight: 600; }
    .sev-high { color: #ea580c; font-weight: 600; }
    .sev-medium { color: #ca8a04; font-weight: 600; }
    .sev-low { color: #16a34a; font-weight: 600; }
    table.data { width: 100%; border-collapse: collapse; font-size: 9pt; margin: 12px 0; }
    table.data th {
      background: #1e3a5f;
      color: #fff;
      text-align: left;
      padding: 8px 10px;
      font-weight: 600;
    }
    table.data td { padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    table.data tr:nth-child(even) td { background: #f8fafc; }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 700;
    }
    .pill.sev-critical { background: #fef2f2; color: #b91c1c; }
    .pill.sev-high { background: #fff7ed; color: #c2410c; }
    .pill.sev-medium { background: #fefce8; color: #a16207; }
    .pill.sev-low { background: #f0fdf4; color: #15803d; }
    .risk-pill { font-weight: 700; color: #b91c1c; }
    .err-msg { color: #475569; max-width: 200px; }
    .heatmap { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
    .heat-cell { padding: 10px 12px; border-radius: 8px; border: 1px solid #fecaca; font-size: 9pt; }
    .heat-cell strong { display: block; margin-bottom: 4px; }
    .heat-cell span { color: #64748b; font-size: 8.5pt; }
    .insight-card {
      background: #f8fafc;
      border-left: 4px solid #2563eb;
      padding: 10px 14px;
      margin-bottom: 10px;
      border-radius: 0 8px 8px 0;
    }
    .insight-card p { margin: 6px 0 0; font-size: 9.5pt; color: #334155; }
    .likelihood { font-size: 8.5pt; color: #64748b; margin-left: 8px; }
    .block-list { margin: 8px 0; padding-left: 20px; color: #b91c1c; }
    .rec-list { list-style: none; padding: 0; margin: 0; }
    .rec-list li { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; font-size: 9.5pt; }
    .rec-num {
      flex-shrink: 0;
      width: 22px;
      height: 22px;
      background: #1e3a5f;
      color: #fff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 8pt;
      font-weight: 700;
    }
    .muted { color: #64748b; font-size: 9.5pt; }
    .page-footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #94a3b8;
      text-align: center;
    }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .callout {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 10px;
      padding: 14px 16px;
      margin: 12px 0;
    }
    .callout strong { color: #1e40af; }
  </style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="cover-brand">Katalon · QA Intelligence</div>
      <h1>Execution Intelligence Report</h1>
      <p class="subtitle">${esc(projectName)}</p>
    </div>
    <dl class="cover-meta">
      <div><dt>Build ID</dt><dd>${esc(ov.buildId)}</dd></div>
      <div><dt>Execution date</dt><dd>${esc(ov.executionDate)}</dd></div>
      <div><dt>Environment</dt><dd>${esc(ov.environment)}</dd></div>
      <div><dt>Release status</dt><dd>${esc(rr.status)} · ${rr.score}/100</dd></div>
    </dl>
    <div class="cover-footer">Confidential — For QA leadership &amp; release governance · Generated ${esc(generated)}</div>
  </section>

  <section class="section">
    <h2 class="section-title">Executive Summary</h2>
    <div class="callout"><strong>${esc(es.releaseStatement)}</strong></div>
    <div class="kpi-row">
      ${kpiCard("Pass rate", `${es.passRatePercent}%`)}
      ${kpiCard("Total tests", String(es.totalTestCases))}
      ${kpiCard("Failed", String(es.failed), `${es.passed} passed · ${es.skipped} skipped`)}
      ${kpiCard("Readiness", `${rr.score}/100`, rr.status, `kpi highlight ${statusClass(rr.status)}`)}
    </div>
    <p><span class="badge ${statusClass(rr.status)}">${esc(rr.status)}</span> &nbsp; Duration: ${esc(es.duration)} · Stability ${ov.stabilityScore}/100 · Risk ${ov.riskScore}/100</p>
  </section>

  <section class="section">
    <h2 class="section-title">Execution Dashboard</h2>
    <div class="charts-row">
      <div class="chart-box">
        <h4>Pass vs fail distribution</h4>
        ${renderPieChart(report.chartData.passFailPie)}
      </div>
      <div class="chart-box">
        <h4>Failure severity</h4>
        ${renderSeverityBars(report.chartData.severityBar)}
      </div>
    </div>
    <p class="muted">${esc(ov.ciSummary)}</p>
  </section>

  <section class="section">
    <h2 class="section-title">Severity &amp; Module Risk</h2>
    <div class="two-col">
      <div>
        <h4 style="margin:0 0 8px;font-size:10pt;color:#475569">Severity counts</h4>
        <table class="data">
          <thead><tr><th>Severity</th><th>Count</th><th>Weight</th></tr></thead>
          <tbody>
            ${report.chartData.severityBar
              .map(
                (b) =>
                  `<tr><td class="${sevClass(b.severity)}">${b.severity}</td><td>${b.count}</td><td>${b.weight}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>
      <div>
        <h4 style="margin:0 0 8px;font-size:10pt;color:#475569">Module risk heatmap</h4>
        ${renderHeatmap(report.chartData.moduleRiskHeatmap)}
      </div>
    </div>
    ${
      moduleRows
        ? `<h4 style="margin:16px 0 8px;font-size:10pt;color:#475569">Module risk table</h4>
        <table class="data">
          <thead><tr><th>Module</th><th>Failures</th><th>Risk</th><th>Stability</th><th>Type</th></tr></thead>
          <tbody>${moduleRows}</tbody>
        </table>`
        : ""
    }
  </section>

  ${
    failedTableRows
      ? `<section class="section">
    <h2 class="section-title">Failed Test Cases</h2>
    <table class="data">
      <thead><tr><th>Test case</th><th>Module</th><th>Severity</th><th>Type</th><th>Error</th></tr></thead>
      <tbody>${failedTableRows}</tbody>
    </table>
  </section>`
      : ""
  }

  ${
    flowRows
      ? `<section class="section">
    <h2 class="section-title">Business Flow Impact</h2>
    <p class="lead">${esc(report.businessFlowImpact.summary)}</p>
    <table class="data">
      <thead><tr><th>Flow</th><th>Pass rate</th><th>Risk</th><th>Impact</th></tr></thead>
      <tbody>${flowRows}</tbody>
    </table>
  </section>`
      : ""
  }

  <section class="section">
    <h2 class="section-title">Release Readiness</h2>
    <div class="kpi-row">
      ${kpiCard("Score", `${rr.score}/100`)}
      ${kpiCard("Status", rr.status, "", statusClass(rr.status))}
      ${kpiCard("Confidence", `${rr.confidencePercent}%`)}
      ${kpiCard("Trend", report.flakyInsights.stabilityTrend)}
    </div>
    <h4 style="margin:12px 0 8px;font-size:10pt;color:#475569">Blocking issues</h4>
    ${blockingList}
  </section>

  <section class="section">
    <h2 class="section-title">Root Cause Insights</h2>
    ${rootCauseHtml || "<p class=\"muted\">No additional insights.</p>"}
  </section>

  <section class="section">
    <h2 class="section-title">Recommendations</h2>
    <ul class="rec-list">${recsHtml}</ul>
  </section>

  <div class="page-footer">
    ${esc(report.pdfTitle)} · ${esc(generated)} · AI-generated QA intelligence — verify before release decisions
  </div>
</body>
</html>`;
}
