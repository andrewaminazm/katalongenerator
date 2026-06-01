import type { ExecutionReportOutput } from "../../api";

export function ExecutionReportRootCauseView({ report }: { report: ExecutionReportOutput }) {
  const insights = report.rootCauseAnalysis?.length
    ? report.rootCauseAnalysis
    : report.rootCauseInsights;

  const rank = { high: 0, medium: 1, low: 2 };
  const sorted = [...insights].sort(
    (a, b) => (rank[a.likelihood as keyof typeof rank] ?? 2) - (rank[b.likelihood as keyof typeof rank] ?? 2)
  );

  return (
    <div className="er-preview-panel">
      <h3>Root Cause Analysis</h3>
      <p className="er-preview-headline">Ranked by likelihood — evidence from failure types and error messages</p>

      {sorted.length === 0 ? (
        <p className="er-form-hint">No root-cause categories identified (clean run or no failures).</p>
      ) : (
        <div className="er-rc-cards">
          {sorted.map((r) => (
            <article key={r.category} className="er-rc-card">
              <header>
                <h4>{r.category}</h4>
                <span className={`er-likelihood er-likelihood--${r.likelihood}`}>{r.likelihood}</span>
              </header>
              <p>{r.summary}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
