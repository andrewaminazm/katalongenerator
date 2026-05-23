import type { FailureAnalysisResult } from "../../api";

export function DetectedPatternsPanel({ result }: { result: FailureAnalysisResult }) {
  if (!result.detectedPatterns?.length) return null;

  return (
    <div className="fa-card">
      <h3>Detected patterns</h3>
      {result.logOnlyMode && (
        <span className="fa-badge-type" style={{ marginBottom: "0.5rem", display: "inline-block" }}>
          Log-only analysis
        </span>
      )}
      <ul className="fa-pattern-list">
        {result.detectedPatterns.map((p) => (
          <li key={p.pattern}>
            <strong>{p.pattern}</strong>
            <span className="fa-priority">{Math.round(p.confidence * 100)}%</span>
            <p className="hint">{p.inference}</p>
          </li>
        ))}
      </ul>
      {result.executionLogInsights && (
        <div className="fa-log-insights hint">
          {result.executionLogInsights.failedTestObject && (
            <p>Failed object: <code>{result.executionLogInsights.failedTestObject}</code></p>
          )}
          {result.executionLogInsights.failedKeyword && (
            <p>Keyword: <code>{result.executionLogInsights.failedKeyword}</code></p>
          )}
          <p>{result.executionLogInsights.timingSummary}</p>
        </div>
      )}
    </div>
  );
}
