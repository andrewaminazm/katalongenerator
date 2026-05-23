import type { FailureAnalysisResult } from "../../api";

const TYPE_LABELS: Record<string, string> = {
  LOCATOR: "Locator failure",
  TIMING: "Timing issue",
  API: "API failure",
  ASSERTION: "Assertion failure",
  ENVIRONMENT: "Environment issue",
  TEST_DATA: "Test data issue",
  FRAMEWORK: "Framework issue",
  BROWSER_AUTOMATION: "Browser / driver issue",
  UNKNOWN: "Unknown",
};

export function RootCauseCard({ result }: { result: FailureAnalysisResult }) {
  return (
    <div className="fa-card fa-root-cause">
      <div className="fa-root-header">
        <h3>Root cause</h3>
        <span className="fa-badge-type">{TYPE_LABELS[result.failureType] ?? result.failureType}</span>
      </div>
      <p className="fa-root-primary">{result.rootCause}</p>
      <p className="hint">{result.rootCauseSummary}</p>
      <div className="fa-meta-row">
        <span>Layer: {result.affectedLayer}</span>
        <span>Severity: {result.severity}</span>
        <span>Repro: {result.reproducibility}</span>
        {result.aiEnhanced && <span className="fa-ai-badge">AI enhanced</span>}
      </div>
      {result.secondaryFactors.length > 0 && (
        <div className="fa-secondary">
          <strong>Contributing factors</strong>
          <ul>
            {result.secondaryFactors.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
