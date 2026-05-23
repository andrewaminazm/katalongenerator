import type { FailureAnalysisResult } from "../../api";

export function SuggestedFixes({ result }: { result: FailureAnalysisResult }) {
  if (!result.suggestedFixes.length) return null;

  return (
    <div className="fa-card">
      <h3>Suggested fixes</h3>
      <ul className="fa-fix-list">
        {result.suggestedFixes.map((fix) => (
          <li key={fix.id} className={`fa-fix-priority-${fix.priority}`}>
            <div className="fa-fix-title">
              <strong>{fix.title}</strong>
              <span className="fa-priority">{fix.priority}</span>
            </div>
            <p className="hint">{fix.description}</p>
            {fix.codeExample && (
              <pre className="fa-code-snippet">{fix.codeExample}</pre>
            )}
          </li>
        ))}
      </ul>
      {result.recommendedArchitectureImprovements.length > 0 && (
        <div className="fa-arch-improvements">
          <strong>Architecture improvements</strong>
          <ul>
            {result.recommendedArchitectureImprovements.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
