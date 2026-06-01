import type { ExecutionReportOutput } from "../../api";

export function ExecutionReportReleaseView({ report }: { report: ExecutionReportOutput }) {
  const es = report.executiveSummary;
  const rr = report.releaseReadiness;
  const intel = report.executiveIntelligence;

  const statusClass =
    rr.status === "BLOCKED"
      ? "er-status-blocked"
      : rr.status === "AT_RISK"
        ? "er-status-risk"
        : "er-status-ready";

  const directorStatus = intel?.directorStatus ?? (rr.status === "BLOCKED" ? "BLOCKED" : rr.status);
  const deployment = intel?.deploymentRecommendation;

  return (
    <div className="er-preview-panel er-release-view">
      <h3>Release Readiness — {es.headline}</h3>
      <p className="er-preview-headline">{es.releaseStatement}</p>

      <div className="er-summary-cards">
        <div className={`er-card er-card--large ${statusClass}`}>
          <span>Readiness score</span>
          <strong>{rr.score}/100</strong>
        </div>
        <div className={`er-card ${statusClass}`}>
          <span>Status</span>
          <strong>{rr.status}</strong>
        </div>
        <div className="er-card">
          <span>Confidence</span>
          <strong>{rr.confidencePercent}%</strong>
        </div>
        <div className="er-card">
          <span>Pass rate</span>
          <strong>{es.passRatePercent}%</strong>
        </div>
      </div>

      {deployment && (
        <div className="er-deployment-card er-deployment-card--prominent">
          <span className="er-deployment-label">Deployment recommendation</span>
          <p className="er-deployment-decision">{deployment.decision}</p>
          <p>{deployment.reasoning}</p>
        </div>
      )}

      <div className="er-preview-section">
        <h4>Director assessment</h4>
        <p>
          QA Director status: <strong>{directorStatus}</strong>
        </p>
        {rr.factors.length > 0 && (
          <>
            <h5>Scoring factors</h5>
            <ul>
              {rr.factors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="er-preview-section er-blocking">
        <h4>Blocking issues</h4>
        {rr.blockingIssues.length === 0 ? (
          <p className="er-form-hint">No blocking issues identified for this snapshot.</p>
        ) : (
          <ul>
            {rr.blockingIssues.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="er-preview-section">
        <h4>Severity gate</h4>
        <ul className="er-sev-list">
          <li className="er-sev-critical">CRITICAL: {es.severityCounts?.CRITICAL ?? 0}</li>
          <li className="er-sev-high">HIGH: {es.severityCounts?.HIGH ?? 0}</li>
        </ul>
      </div>

      {report.recommendations.length > 0 && (
        <div className="er-preview-section">
          <h4>Required engineering actions</h4>
          <ul>
            {report.recommendations.map((rec) => (
              <li key={rec}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {!intel && (
        <p className="er-form-hint">
          For full Section 4–12 executive narrative, generate with <strong>Executive</strong> or{" "}
          <strong>Release</strong> report type selected.
        </p>
      )}
    </div>
  );
}
