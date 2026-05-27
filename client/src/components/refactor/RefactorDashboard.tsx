import type { RefactorAnalysisResult } from "../../api";
import { DuplicationHeatmap } from "./DuplicationHeatmap";
import { RecommendationCard } from "./RecommendationCard";

type Props = {
  result: RefactorAnalysisResult;
};

export function RefactorDashboard({ result }: Props) {
  return (
    <>
      <div className="ref-cards">
        <div className="ref-card">
          <p className="ref-card-label">Maintainability</p>
          <p className="ref-card-value">{result.maintainabilityScore}</p>
        </div>
        <div className="ref-card">
          <p className="ref-card-label">Duplication health</p>
          <p className="ref-card-value">{result.duplicationScore}</p>
        </div>
        <div className="ref-card">
          <p className="ref-card-label">OR health</p>
          <p className="ref-card-value">{result.orHealthScore}</p>
        </div>
        <div className="ref-card">
          <p className="ref-card-label">Assertion quality</p>
          <p className="ref-card-value">{result.assertionQualityScore}</p>
        </div>
        <div className="ref-card">
          <p className="ref-card-label">Framework health</p>
          <p className="ref-card-value">{result.frameworkHealthScore}</p>
        </div>
        <div className="ref-card">
          <p className="ref-card-label">Wait stability</p>
          <p className="ref-card-value">{result.waitStabilityScore}</p>
        </div>
      </div>

      <div className="ref-grid-2">
        <section className="ref-panel">
          <h2>Top refactoring recommendations</h2>
          <div className="ref-panel-body">
            {result.recommendations.length === 0 ? (
              <p className="ref-empty">No recommendations — framework looks healthy.</p>
            ) : (
              result.recommendations.slice(0, 8).map((r) => <RecommendationCard key={r.id} item={r} />)
            )}
          </div>
        </section>
        <section className="ref-panel">
          <h2>Duplication by module</h2>
          <div className="ref-panel-body">
            <DuplicationHeatmap cells={result.duplicationHeatmap} />
          </div>
        </section>
      </div>

      <div className="ref-grid-2" style={{ marginTop: "1rem" }}>
        <section className="ref-panel">
          <h2>Duplicate flows</h2>
          <div className="ref-panel-body">
            {result.duplicateFlows.length === 0 ? (
              <p className="ref-empty">No repeated flow patterns detected.</p>
            ) : (
              <table className="ref-table">
                <thead>
                  <tr>
                    <th>Pattern</th>
                    <th>Scripts</th>
                    <th>Suggested keyword</th>
                  </tr>
                </thead>
                <tbody>
                  {result.duplicateFlows.slice(0, 12).map((f) => (
                    <tr key={f.pattern.slice(0, 40)}>
                      <td title={f.pattern}>{f.pattern.slice(0, 48)}…</td>
                      <td>{f.scripts.length}</td>
                      <td>{f.suggestedKeyword ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
        <section className="ref-panel">
          <h2>Architecture insights</h2>
          <div className="ref-panel-body">
            {result.architectureInsights.length === 0 ? (
              <p className="ref-empty">No architecture notes.</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--text-small)" }}>
                {result.architectureInsights.map((a) => (
                  <li key={a.id} style={{ marginBottom: "0.5rem" }}>
                    <strong>{a.area}:</strong> {a.insight}
                    <br />
                    <span className="ref-rec-meta">{a.recommendation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <div className="ref-grid-2" style={{ marginTop: "1rem" }}>
        <section className="ref-panel">
          <h2>OR & keyword drilldown</h2>
          <div className="ref-panel-body">
            <p className="ref-card-label">OR issues ({result.orProblems.length})</p>
            <ul style={{ fontSize: "var(--text-small)", paddingLeft: "1rem" }}>
              {result.orProblems.slice(0, 6).map((o) => (
                <li key={o.path}>
                  {o.path}: {o.problem}
                </li>
              ))}
            </ul>
            <p className="ref-card-label" style={{ marginTop: "0.75rem" }}>
              Keyword issues ({result.keywordProblems.length})
            </p>
            <ul style={{ fontSize: "var(--text-small)", paddingLeft: "1rem" }}>
              {result.keywordProblems.slice(0, 6).map((k) => (
                <li key={k.path}>
                  {k.className}: {k.problem}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="ref-panel">
          <h2>Weak assertions</h2>
          <div className="ref-panel-body">
            {result.weakAssertions.length === 0 ? (
              <p className="ref-empty">No validation-light scripts flagged.</p>
            ) : (
              <table className="ref-table">
                <thead>
                  <tr>
                    <th>Script</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.weakAssertions.slice(0, 10).map((w) => (
                    <tr key={w.scriptPath}>
                      <td>{w.logicalPath}</td>
                      <td>{w.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {result.fromCache && (
        <p className="ref-rec-meta" style={{ marginTop: "0.75rem" }}>
          Loaded from cache · {new Date(result.analyzedAt).toLocaleString()}
        </p>
      )}
    </>
  );
}
