import type { FailureAnalysisResult } from "../../api";

export function LocatorIssuePanel({ result }: { result: FailureAnalysisResult }) {
  const li = result.locatorInsights;
  if (!li) return null;

  return (
    <div className="fa-card fa-panel-locator">
      <h3>Locator analysis</h3>
      <p>{li.problem}</p>
      <p className="hint">{li.recommendation}</p>
      <div className="fa-flags">
        {li.isDynamic && <span className="fa-flag">Dynamic locator</span>}
        {li.domChangeLikely && <span className="fa-flag">DOM change likely</span>}
      </div>
    </div>
  );
}
