import type { FailureAnalysisResult } from "../../api";

export function ApiFailurePanel({ result }: { result: FailureAnalysisResult }) {
  const api = result.apiInsights;
  if (!api) return null;

  return (
    <div className="fa-card fa-panel-api">
      <h3>API failure analysis</h3>
      <p>{api.problem}</p>
      <p className="hint">{api.recommendation}</p>
      <div className="fa-flags">
        {api.statusCode != null && <span className="fa-flag">HTTP {api.statusCode}</span>}
        {api.authIssue && <span className="fa-flag">Auth issue</span>}
      </div>
    </div>
  );
}
