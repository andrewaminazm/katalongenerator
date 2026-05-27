import type { ExecutionReportOutput } from "../../api";

export function ExecutionReportPreview({ report }: { report: ExecutionReportOutput }) {
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
        <div className={`er-card ${statusClass}`}>
          <span>Release</span>
          <strong>{rr.status}</strong>
        </div>
        <div className="er-card">
          <span>Readiness</span>
          <strong>{rr.score}/100</strong>
        </div>
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
          <h4>Top module risk</h4>
          <ul>
            {modules.slice(0, 5).map((m) => (
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
            {flows.slice(0, 5).map((f) => (
              <li key={f.flowName}>
                {f.flowName} — risk {f.riskScore}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rootCauses.length > 0 && (
        <div className="er-preview-section">
          <h4>Root cause insights</h4>
          <ul>
            {rootCauses.slice(0, 4).map((r) => (
              <li key={r.category}>
                <strong>{r.category}:</strong> {r.summary}
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.recommendations.length > 0 && (
        <div className="er-preview-section">
          <h4>Recommendations</h4>
          <ul>
            {report.recommendations.slice(0, 6).map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {rr.blockingIssues.length > 0 && (
        <div className="er-preview-section er-blocking">
          <h4>Blocking issues</h4>
          <ul>
            {rr.blockingIssues.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
