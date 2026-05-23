import type { FailureAnalysisResult } from "../../api";

export function PlainEnglishSummary({ result }: { result: FailureAnalysisResult }) {
  const report = result.plainEnglish;
  if (!report) return null;

  return (
    <div className="fa-card fa-plain-english">
      <h3>What this means</h3>
      <p className="fa-plain-headline">{report.headline}</p>

      <div className="fa-plain-block">
        <strong>What happened</strong>
        <p>{report.whatHappened}</p>
      </div>

      <div className="fa-plain-block">
        <strong>Why it likely failed</strong>
        <p>{report.likelyReason}</p>
      </div>

      {report.errorSnippet && (
        <div className="fa-plain-block">
          <strong>Error from log</strong>
          <code className="fa-plain-error">{report.errorSnippet}</code>
        </div>
      )}

      <div className="fa-plain-block">
        <strong>What to try</strong>
        <ol className="fa-plain-steps">
          {report.stepsToTry.map((step) => (
            <li key={step}>{step.replace(/^\d+\.\s*/, "")}</li>
          ))}
        </ol>
      </div>

      <p className="hint fa-plain-footer">
        {result.logOnlyMode
          ? "Based on your Katalon execution log."
          : "Based on logs and any extra evidence you provided."}{" "}
        Confidence: {Math.round((result.rootCauseConfidence ?? result.confidence) * 100)}%
        {result.flakyProbability >= 0.5
          ? ` · May be flaky (${Math.round(result.flakyProbability * 100)}%)`
          : " · Likely reproducible (not flaky)"}
      </p>
    </div>
  );
}
