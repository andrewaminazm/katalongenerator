import type { CoverageAnalysisResult } from "../../api";
import { CoverageTable } from "./CoverageTable";
import { RecommendationPanel } from "./RecommendationPanel";
import { RiskHeatmap } from "./RiskHeatmap";

type Props = {
  result: CoverageAnalysisResult;
};

export function CoverageDashboard({ result }: Props) {
  return (
    <>
      <div className="cov-cards">
        <div className="cov-card">
          <p className="cov-card-label">Overall coverage</p>
          <p className="cov-card-value">{result.overallCoverage}%</p>
        </div>
        <div className="cov-card">
          <p className="cov-card-label">Risk score</p>
          <p className="cov-card-value cov-card-value--risk">{result.riskScore}</p>
        </div>
        <div className="cov-card">
          <p className="cov-card-label">Maintainability</p>
          <p className="cov-card-value">{result.maintainabilityScore}</p>
        </div>
        <div className="cov-card">
          <p className="cov-card-label">Missing scenarios</p>
          <p className="cov-card-value">{result.missingScenarioCount}</p>
        </div>
        <div className="cov-card">
          <p className="cov-card-label">Weak assertions</p>
          <p className="cov-card-value">{result.weakAssertions.length}</p>
        </div>
        {result.apiCoverage && (
          <div className="cov-card">
            <p className="cov-card-label">API coverage</p>
            <p className="cov-card-value">{result.apiCoverage.coveragePercent}%</p>
          </div>
        )}
      </div>

      <div className="cov-grid-2">
        <section className="cov-panel">
          <h2>Module risk heatmap</h2>
          <div className="cov-panel-body">
            <RiskHeatmap cells={result.heatmap} />
          </div>
        </section>
        <section className="cov-panel">
          <h2>Module drilldown</h2>
          <div className="cov-panel-body">
            <CoverageTable rows={result.modules} />
          </div>
        </section>
      </div>

      <div className="cov-grid-2">
        <section className="cov-panel">
          <h2>AI recommendations</h2>
          <div className="cov-panel-body">
            <RecommendationPanel items={result.recommendations} />
          </div>
        </section>
        <section className="cov-panel">
          <h2>Business flows</h2>
          <div className="cov-panel-body">
            {result.businessFlows.length === 0 ? (
              <p className="cov-empty">No flows inferred.</p>
            ) : (
              <table className="cov-table">
                <thead>
                  <tr>
                    <th>Flow</th>
                    <th>Coverage</th>
                    <th>Risk</th>
                    <th>Gaps</th>
                  </tr>
                </thead>
                <tbody>
                  {result.businessFlows.map((f) => (
                    <tr key={f.name}>
                      <td>{f.name}</td>
                      <td>{f.coveragePercent}%</td>
                      <td>
                        <span className={`cov-sev cov-sev--${f.riskLevel}`}>{f.riskLevel}</span>
                      </td>
                      <td>{f.gaps.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {result.duplicateFlows.length > 0 && (
        <section className="cov-panel" style={{ marginTop: "1rem" }}>
          <h2>Duplicated flows</h2>
          <div className="cov-panel-body">
            <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "var(--text-small)" }}>
              {result.duplicateFlows.slice(0, 8).map((d) => (
                <li key={d.pattern}>
                  {d.scripts.length} scripts share pattern: {d.scripts.slice(0, 3).join(", ")}
                  {d.scripts.length > 3 ? "…" : ""}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
