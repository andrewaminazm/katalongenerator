import type { FailureAnalysisResult } from "../../api";

export function TimingIssuePanel({ result }: { result: FailureAnalysisResult }) {
  const ti = result.timingInsights;
  if (!ti) return null;

  return (
    <div className="fa-card fa-panel-timing">
      <h3>Timing analysis</h3>
      <p>{ti.problem}</p>
      <p className="hint">{ti.recommendation}</p>
      {ti.raceConditionLikely && (
        <span className="fa-flag">Race condition likely</span>
      )}
    </div>
  );
}
