import type { ExecutionReportOutput } from "../../api";
import { getSeverityAnalysis } from "./executionReportViewUtils";

export function ExecutionReportSeverityView({ report }: { report: ExecutionReportOutput }) {
  const es = report.executiveSummary;
  const sev = es.severityCounts ?? {};
  const analysis = getSeverityAnalysis(report);

  return (
    <div className="er-preview-panel">
      <h3>Failure Severity Analysis</h3>
      <p className="er-preview-headline">{report.pdfTitle}</p>

      <div className="er-summary-cards">
        <div className="er-card er-sev-critical">
          <span>Critical</span>
          <strong>{sev.CRITICAL ?? 0}</strong>
        </div>
        <div className="er-card er-sev-high">
          <span>High</span>
          <strong>{sev.HIGH ?? 0}</strong>
        </div>
        <div className="er-card er-sev-medium">
          <span>Medium</span>
          <strong>{sev.MEDIUM ?? 0}</strong>
        </div>
        <div className="er-card er-sev-low">
          <span>Low</span>
          <strong>{sev.LOW ?? 0}</strong>
        </div>
      </div>

      <div className="er-preview-section">
        <h4>Weighted risk</h4>
        <p>
          Severity-weighted risk points: <strong>{analysis.weightedRiskPoints}</strong>
        </p>
      </div>

      {analysis.topFailingModules.length > 0 && (
        <div className="er-preview-section">
          <h4>Top failing modules</h4>
          <table className="er-data-table">
            <thead>
              <tr>
                <th>Module</th>
                <th>Failures</th>
                <th>Max severity</th>
              </tr>
            </thead>
            <tbody>
              {analysis.topFailingModules.map((m) => (
                <tr key={m.module}>
                  <td>{m.module}</td>
                  <td>{m.count}</td>
                  <td>{m.maxSeverity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {analysis.criticalFailures.length > 0 ? (
        <div className="er-preview-section er-blocking">
          <h4>Critical & high failures</h4>
          <table className="er-data-table">
            <thead>
              <tr>
                <th>Bug</th>
                <th>Jira</th>
                <th>Module</th>
                <th>Severity</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {analysis.criticalFailures.map((c) => (
                <tr key={`${c.bugName}-${c.module}`}>
                  <td>{c.bugName}</td>
                  <td>{c.jiraId ?? ""}</td>
                  <td>{c.module}</td>
                  <td>{c.severity}</td>
                  <td className="er-cell-error">{c.errorMessage ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="er-form-hint">No critical or high-severity failures in this snapshot.</p>
      )}
    </div>
  );
}
