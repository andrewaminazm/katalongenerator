import type { FailureAnalysisResult } from "../../api";

function riskClass(level?: string): string {
  const l = (level ?? "").toLowerCase();
  if (l === "critical" || l === "high") return "fa-risk-high";
  if (l === "medium") return "fa-risk-medium";
  return "fa-risk-low";
}

export function ReliabilityIntelligencePanel({ result }: { result: FailureAnalysisResult }) {
  const rel = result.reliability;
  if (!rel) return null;

  return (
    <div className="fa-reliability-panel">
      <h3 className="fa-reliability-title">Reliability intelligence</h3>

      <div className="fa-reliability-scores">
        <div className="fa-reliability-score-card">
          <span className="fa-reliability-label">Reliability</span>
          <strong>{rel.reliabilityScore}%</strong>
        </div>
        <div className="fa-reliability-score-card">
          <span className="fa-reliability-label">Root cause confidence</span>
          <strong>{rel.rootCauseConfidence}%</strong>
        </div>
        <div className="fa-reliability-score-card">
          <span className="fa-reliability-label">Flaky probability</span>
          <strong>{rel.flakyProbability}%</strong>
        </div>
        <div className="fa-reliability-score-card">
          <span className="fa-reliability-label">Repair success</span>
          <strong>{rel.repairSuccessPrediction}%</strong>
        </div>
        <div className={`fa-reliability-score-card fa-risk-badge ${riskClass(rel.riskLevel)}`}>
          <span className="fa-reliability-label">Risk</span>
          <strong>{rel.riskLevel}</strong>
        </div>
      </div>

      {rel.failureCluster && (
        <div className="fa-card fa-reliability-section">
          <h4>Failure cluster</h4>
          <p className="hint">{rel.failureCluster}</p>
        </div>
      )}

      {rel.confidenceExplanation.length > 0 && (
        <div className="fa-card fa-reliability-section">
          <h4>Confidence explanation</h4>
          <ul>
            {rel.confidenceExplanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}

      {rel.locatorHealth && (
        <div className="fa-card fa-reliability-section">
          <h4>Locator health — {rel.locatorHealth.label}</h4>
          <p>
            Health <strong>{rel.locatorHealth.healthScore}%</strong> · Stability{" "}
            {rel.locatorHealth.stabilityScore}% · Failures in memory: {rel.locatorHealth.failureCount}
          </p>
          {rel.locatorHealth.reasons.length > 0 && (
            <ul>
              {rel.locatorHealth.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {rel.historicalFailures.length > 0 && (
        <div className="fa-card fa-reliability-section">
          <h4>Similar historical failures</h4>
          <ul>
            {rel.historicalFailures.map((h) => (
              <li key={h.id}>
                {h.rootCauseSummary.slice(0, 70)} ({Math.round(h.similarity * 100)}% match)
              </li>
            ))}
          </ul>
        </div>
      )}

      {rel.regressionImpact && (
        <div className="fa-card fa-reliability-section">
          <h4>Regression impact</h4>
          <p className="hint">
            ~{rel.regressionImpact.impactedTestCases} test cases · {rel.regressionImpact.impactedOrObjects}{" "}
            OR · {rel.regressionImpact.impactedFlows} flows · risk {rel.regressionImpact.riskScore}
          </p>
          <ul>
            {rel.regressionImpact.topDependencies.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {rel.preventiveSuggestions.length > 0 && (
        <div className="fa-card fa-reliability-section">
          <h4>Prevention suggestions</h4>
          <ul>
            {rel.preventiveSuggestions.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {rel.repairRecommendations.length > 0 && (
        <div className="fa-card fa-reliability-section">
          <h4>Smart repairs</h4>
          {rel.repairRecommendations.slice(0, 4).map((r) => (
            <div key={r.id} className="fa-smart-repair">
              <strong>{r.title}</strong>
              <span className="hint">
                {" "}
                — {r.repairSuccessPrediction}% predicted success
              </span>
              <p>{r.description}</p>
              {r.groovySnippet && (
                <pre className="fa-groovy-snippet">{r.groovySnippet}</pre>
              )}
            </div>
          ))}
        </div>
      )}

      {rel.environmentInsights && (
        <div className="fa-card fa-reliability-section">
          <h4>Environment insights</h4>
          <p>{rel.environmentInsights.recommendation}</p>
          <ul>
            {rel.environmentInsights.signals.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {rel.businessFlowRisk && (
        <div className="fa-card fa-reliability-section">
          <h4>Business flow — {rel.businessFlowRisk.flowName}</h4>
          <p>
            Stability {rel.businessFlowRisk.stabilityScore}% · {rel.businessFlowRisk.riskLevel} · trend{" "}
            {rel.businessFlowRisk.flakyTrend}
          </p>
        </div>
      )}

      {rel.stabilityTimeline.length > 0 && (
        <div className="fa-card fa-reliability-section">
          <h4>Stability timeline</h4>
          <ul className="fa-timeline-list">
            {rel.stabilityTimeline.map((t, i) => (
              <li key={`${t.date}-${i}`}>
                <span className="fa-timeline-date">{t.date}</span> {t.event}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rel.rootCauseGraph.nodes.length > 1 && (
        <div className="fa-card fa-reliability-section">
          <h4>Root cause graph</h4>
          <ul className="fa-graph-list">
            {rel.rootCauseGraph.edges.map((e, i) => (
              <li key={i}>
                {e.from} → {e.to} ({e.relation})
              </li>
            ))}
          </ul>
        </div>
      )}

      {rel.heatmapSlice.length > 0 && (
        <div className="fa-card fa-reliability-section">
          <h4>Reliability heatmap (this failure)</h4>
          <div className="fa-heatmap-row">
            {rel.heatmapSlice.map((c) => (
              <span
                key={c.id}
                className="fa-heatmap-cell"
                style={{ opacity: 0.4 + c.riskScore / 120 }}
                title={`${c.label}: risk ${c.riskScore}`}
              >
                {c.label} ({c.riskScore})
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
