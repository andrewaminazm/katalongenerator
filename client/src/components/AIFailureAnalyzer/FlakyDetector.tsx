import type { FailureAnalysisResult } from "../../api";

export function FlakyDetector({ result }: { result: FailureAnalysisResult }) {
  const pct = Math.round(result.flakyProbability * 100);
  const isBug = pct < 35;

  return (
    <div className="fa-card fa-flaky">
      <h3>Flaky vs real bug</h3>
      <p className="fa-flaky-verdict">
        {isBug ? (
          <span className="fa-tag fa-tag-bug">Likely real defect</span>
        ) : pct >= 65 ? (
          <span className="fa-tag fa-tag-flaky">Likely flaky test</span>
        ) : (
          <span className="fa-tag fa-tag-mixed">Mixed signals</span>
        )}
      </p>
      <p className="hint">
        Flaky probability: <strong>{pct}%</strong> ({result.flakyLevel})
      </p>
      <div className="fa-meter-track">
        <div
          className="fa-meter-fill fa-meter-flaky"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
