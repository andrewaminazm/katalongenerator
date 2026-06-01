import type { ExecutionReportOutput } from "../../api";
import { getFlakyInsights } from "./executionReportViewUtils";

export function ExecutionReportFlakyView({ report }: { report: ExecutionReportOutput }) {
  const flaky = getFlakyInsights(report);
  const trendClass =
    flaky.stabilityTrend === "degrading"
      ? "er-trend-bad"
      : flaky.stabilityTrend === "stable"
        ? "er-trend-good"
        : "er-trend-unknown";

  return (
    <div className="er-preview-panel">
      <h3>Flaky Test Intelligence</h3>
      <p className="er-preview-headline">
        Stability trend: <span className={trendClass}>{flaky.stabilityTrend}</span>
      </p>

      {flaky.flakyCandidates.length > 0 && (
        <div className="er-preview-section">
          <h4>Flaky candidates</h4>
          <ul>
            {flaky.flakyCandidates.map((name) => (
              <li key={name}>
                <strong>{name}</strong> — review waits, data isolation, and environment parity
              </li>
            ))}
          </ul>
        </div>
      )}

      {flaky.repeatedFailureSignals.length > 0 && (
        <div className="er-preview-section">
          <h4>Repeated failure signals</h4>
          <ul>
            {flaky.repeatedFailureSignals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {flaky.regressionSignals.length > 0 && (
        <div className="er-preview-section">
          <h4>Regression signals</h4>
          <ul>
            {flaky.regressionSignals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {flaky.flakyCandidates.length === 0 &&
        flaky.repeatedFailureSignals.length === 0 &&
        flaky.regressionSignals.length === 0 && (
          <p className="er-form-hint">No flaky or regression patterns detected in this failure set.</p>
        )}
    </div>
  );
}
