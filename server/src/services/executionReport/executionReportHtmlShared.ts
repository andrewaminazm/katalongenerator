import type { ExecutionReportOutput } from "./types.js";
import type { ExecutionReportPdfType } from "./executionReportPdfTypes.js";
import { EXECUTION_REPORT_PDF_META } from "./executionReportPdfTypes.js";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function statusClass(status: string): string {
  if (status === "BLOCKED") return "badge-blocked";
  if (status === "AT_RISK") return "badge-risk";
  return "badge-ready";
}

export function sevClass(sev: string): string {
  return `sev-${sev.toLowerCase()}`;
}

export function kpiCard(label: string, value: string, sub?: string, extraClass = ""): string {
  return `<div class="kpi ${extraClass}">
    <span class="kpi-label">${esc(label)}</span>
    <strong class="kpi-value">${esc(value)}</strong>
    ${sub ? `<span class="kpi-sub">${esc(sub)}</span>` : ""}
  </div>`;
}

export function renderPdfStyles(): string {
  return `
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
    .cover h1 { font-size: 28pt; font-weight: 700; margin: 24px 0 8px; line-height: 1.15; letter-spacing: -0.02em; }
    .cover .subtitle { font-size: 13pt; opacity: 0.9; margin: 0 0 32px; max-width: 90%; }
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
    .err-msg { color: #475569; max-width: 220px; word-break: break-word; }
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
    .callout-danger {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      padding: 16px 18px;
      margin: 16px 0;
    }
    .callout-danger .decision { font-size: 16pt; font-weight: 700; color: #b91c1c; margin: 8px 0; }
    .cluster-card {
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      margin-bottom: 10px;
      background: #f8fafc;
    }
    .cluster-card h4 { margin: 0 0 6px; font-size: 11pt; color: #1e3a5f; }
    .cluster-card ul { margin: 8px 0 0; padding-left: 18px; font-size: 9pt; }
    .action-p0 { background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; }
    .action-p0 h4 { color: #b91c1c; margin: 0 0 8px; }
    .exec-section {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      margin-bottom: 10px;
      page-break-inside: avoid;
    }
    .exec-section h3 { margin: 0 0 8px; font-size: 11pt; color: #1e3a5f; }
    .exec-section pre {
      margin: 0;
      white-space: pre-wrap;
      font-family: inherit;
      font-size: 9pt;
      color: #334155;
      line-height: 1.4;
    }
  `;
}

export function renderCover(
  report: ExecutionReportOutput,
  reportType: ExecutionReportPdfType
): string {
  const es = report.executiveSummary;
  const ov = report.executionOverview;
  const rr = report.releaseReadiness;
  const meta = EXECUTION_REPORT_PDF_META[reportType];
  const projectName = es.headline.split("—")[0]?.trim() || report.pdfTitle;
  const generated = new Date(report.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return `<section class="cover">
    <div>
      <div class="cover-brand">Katalon · QA Intelligence</div>
      <h1>${esc(meta.title)}</h1>
      <p class="subtitle">${esc(projectName)} — ${esc(meta.coverSubtitle)}</p>
    </div>
    <dl class="cover-meta">
      <div><dt>Build ID</dt><dd>${esc(ov.buildId)}</dd></div>
      <div><dt>Execution date</dt><dd>${esc(ov.executionDate)}</dd></div>
      <div><dt>Environment</dt><dd>${esc(ov.environment)}</dd></div>
      <div><dt>Release status</dt><dd>${esc(rr.status)} · ${rr.score}/100</dd></div>
    </dl>
    <div class="cover-footer">Confidential — QA leadership &amp; release governance · ${esc(generated)}</div>
  </section>`;
}

export function renderPageFooter(report: ExecutionReportOutput, reportType: ExecutionReportPdfType): string {
  const meta = EXECUTION_REPORT_PDF_META[reportType];
  const generated = new Date(report.generatedAt).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return `<div class="page-footer">
    ${esc(report.pdfTitle)} · ${esc(meta.title)} · ${esc(generated)} · Verify before release decisions
  </div>`;
}
