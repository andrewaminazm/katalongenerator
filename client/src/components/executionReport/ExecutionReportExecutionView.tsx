import type { ExecutionReportOutput } from "../../api";

export function ExecutionReportExecutionView({ report }: { report: ExecutionReportOutput }) {
  const es = report.executiveSummary;
  const rr = report.releaseReadiness;
  const sev = es.severityCounts ?? {};

  const statusClass =
    rr.status === "BLOCKED"
      ? "er-status-blocked"
      : rr.status === "AT_RISK"
        ? "er-status-risk"
        : "er-status-ready";

  const modules = (report.moduleRiskAnalysis as { modules?: Array<{ module: string; riskScore: number }> })
    ?.modules;
  const flows = report.businessFlowAnalysis?.flows ?? report.businessFlowImpact?.flows;
  const rootCauses = report.rootCauseAnalysis?.length
    ? report.rootCauseAnalysis
    : report.rootCauseInsights;

  return (
    <div className="er-preview-panel">
      <h3>{report.pdfTitle}</h3>
      <p className="er-preview-headline">{es.releaseStatement}</p>

      <div className="er-summary-cards">
        <div className="er-card">
          <span>Pass rate</span>
          <strong>{es.passRatePercent}%</strong>
        </div>
        <div className="er-card">
          <span>Stability</span>
          <strong>{report.executionOverview.stabilityScore}</strong>
        </div>
        <div className="er-card">
          <span>Risk</span>
          <strong>{report.executionOverview.riskScore}</strong>
        </div>
        <div className={`er-card ${statusClass}`}>
          <span>Release</span>
          <strong>{rr.status}</strong>
        </div>
      </div>

      <div className="er-preview-section">
        <h4>Execution totals</h4>
        <ul>
          <li>
            Passed / Failed / Skipped: {es.passed} / {es.failed} / {es.skipped} (of {es.totalTestCases})
          </li>
          <li>Duration: {es.duration}</li>
          <li>Environment: {report.executionOverview.environment}</li>
          <li>Build: {report.executionOverview.buildId}</li>
          {report.executionOverview.ciSummary && <li>{report.executionOverview.ciSummary}</li>}
        </ul>
      </div>

      <div className="er-preview-section">
        <h4>Severity breakdown</h4>
        <ul className="er-sev-list">
          <li className="er-sev-critical">CRITICAL: {sev.CRITICAL ?? 0}</li>
          <li className="er-sev-high">HIGH: {sev.HIGH ?? 0}</li>
          <li className="er-sev-medium">MEDIUM: {sev.MEDIUM ?? 0}</li>
          <li className="er-sev-low">LOW: {sev.LOW ?? 0}</li>
        </ul>
      </div>

      {modules && modules.length > 0 && (
        <div className="er-preview-section">
          <h4>Module risk</h4>
          <ul>
            {modules.slice(0, 10).map((m) => (
              <li key={m.module}>
                {m.module} — risk {m.riskScore}
              </li>
            ))}
          </ul>
        </div>
      )}

      {flows && flows.length > 0 && (
        <div className="er-preview-section">
          <h4>Business flows</h4>
          <ul>
            {flows.map((f) => (
              <li key={f.flowName}>
                {f.flowName} — risk {f.riskScore}
                {f.passRatePercent != null ? ` · pass est. ${f.passRatePercent}%` : ""}
              </li>
            ))}
          </ul>
          <p className="er-form-hint">{report.businessFlowImpact?.summary}</p>
        </div>
      )}

      {rootCauses.length > 0 && (
        <div className="er-preview-section">
          <h4>Root cause insights</h4>
          <ul>
            {rootCauses.map((r) => (
              <li key={r.category}>
                <strong>{r.category}</strong> ({r.likelihood}): {r.summary}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.flakyInsights && (
        <div className="er-preview-section">
          <h4>Flaky & stability</h4>
          <ul>
            <li>Trend: {(report.flakyInsights as { stabilityTrend?: string }).stabilityTrend ?? "—"}</li>
          </ul>
        </div>
      )}

      {report.recommendations.length > 0 && (
        <div className="er-preview-section">
          <h4>Recommendations</h4>
          <ul>
            {report.recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
