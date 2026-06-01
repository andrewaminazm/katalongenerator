import type { ExecutionReportOutput } from "../../api";
import { getChartData } from "./executionReportViewUtils";

function BarChart({
  items,
  valueKey,
  labelKey,
  max,
}: {
  items: Array<Record<string, string | number>>;
  valueKey: string;
  labelKey: string;
  max?: number;
}) {
  const peak = max ?? Math.max(1, ...items.map((i) => Number(i[valueKey]) || 0));
  return (
    <div className="er-bar-chart">
      {items.map((item) => {
        const val = Number(item[valueKey]) || 0;
        const pct = Math.round((val / peak) * 100);
        return (
          <div key={String(item[labelKey])} className="er-bar-row">
            <span className="er-bar-label">{item[labelKey]}</span>
            <div className="er-bar-track">
              <div className="er-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="er-bar-value">{val}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ExecutionReportDashboardView({ report }: { report: ExecutionReportOutput }) {
  const es = report.executiveSummary;
  const charts = getChartData(report);
  const eo = report.executionOverview;

  const passFail = charts.passFailPie.length
    ? charts.passFailPie
    : [
        { label: "Passed", value: es.passed },
        { label: "Failed", value: es.failed },
        { label: "Skipped", value: es.skipped },
      ];

  return (
    <div className="er-preview-panel er-dashboard-view">
      <h3>Quality Dashboard</h3>
      <p className="er-preview-headline">Visual snapshot — {es.passRatePercent}% pass rate</p>

      <div className="er-summary-cards">
        <div className="er-card">
          <span>Stability</span>
          <strong>{eo.stabilityScore}</strong>
        </div>
        <div className="er-card">
          <span>Risk</span>
          <strong>{eo.riskScore}</strong>
        </div>
        <div className="er-card">
          <span>Readiness</span>
          <strong>{report.releaseReadiness.score}/100</strong>
        </div>
      </div>

      <div className="er-preview-section">
        <h4>Pass / fail / skip</h4>
        <BarChart
          items={passFail.map((p) => ({ label: p.label, value: p.value }))}
          labelKey="label"
          valueKey="value"
        />
      </div>

      {charts.severityBar.length > 0 && (
        <div className="er-preview-section">
          <h4>Severity distribution</h4>
          <BarChart
            items={charts.severityBar.map((s) => ({
              label: s.severity,
              value: s.count,
            }))}
            labelKey="label"
            valueKey="value"
          />
        </div>
      )}

      {charts.moduleRiskHeatmap.length > 0 && (
        <div className="er-preview-section">
          <h4>Module risk heatmap</h4>
          <BarChart
            items={charts.moduleRiskHeatmap.map((m) => ({
              label: m.module,
              value: m.riskScore,
            }))}
            labelKey="label"
            valueKey="value"
          />
        </div>
      )}
    </div>
  );
}
