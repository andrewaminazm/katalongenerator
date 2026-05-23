import type { FailureAnalysisResult } from "../../api";

function Meter({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  const pct = Math.round(value * 100);
  const level = pct >= 75 ? "high" : pct >= 50 ? "medium" : "low";
  return (
    <div className={`fa-confidence fa-confidence-${level} ${className ?? ""}`}>
      <div className="fa-confidence-header">
        <span className="field-label">{label}</span>
        <strong>{pct}%</strong>
      </div>
      <div className="fa-meter-track" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="fa-meter-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ConfidenceMeter({ result }: { result: FailureAnalysisResult }) {
  const rootConf = result.rootCauseConfidence ?? result.confidence;
  const fixConf = result.suggestedFixConfidence ?? result.confidence * 0.9;
  const flakyPct = Math.round(result.flakyProbability * 100);

  return (
    <div className="fa-confidence-group">
      <Meter label="Root cause confidence" value={rootConf} />
      <Meter label="Flaky probability" value={result.flakyProbability} className="fa-meter-flaky-wrap" />
      <div className="fa-confidence-header">
        <span className="field-label">Flaky level</span>
        <strong>{flakyPct}% ({result.flakyLevel})</strong>
      </div>
      <Meter label="Suggested fix confidence" value={fixConf} />
      {result.confidenceNotes && <p className="hint">{result.confidenceNotes}</p>}
      {result.uncertainty && <p className="hint fa-uncertainty">{result.uncertainty}</p>}
    </div>
  );
}
