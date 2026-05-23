import type { FailureAnalysisResult } from "../../api";

export function FailureTimeline({ result }: { result: FailureAnalysisResult }) {
  if (!result.timeline.length) return null;

  return (
    <div className="fa-card">
      <h3>Failure timeline</h3>
      <ol className="fa-timeline">
        {result.timeline.map((ev) => (
          <li key={ev.id} className={`fa-tl-${ev.kind}`}>
            <span className="fa-tl-kind">{ev.kind}</span>
            <span className="fa-tl-label">{ev.label}</span>
            {ev.detail && <span className="hint">{ev.detail}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
