import type { ExecutionReportOutput } from "../../api";
import { getBusinessFlows } from "./executionReportViewUtils";

export function ExecutionReportFlowsView({ report }: { report: ExecutionReportOutput }) {
  const flows = getBusinessFlows(report);
  const summary = report.businessFlowImpact?.summary ?? report.businessFlowAnalysis?.summary;

  return (
    <div className="er-preview-panel">
      <h3>Business Flow Impact</h3>
      {summary && <p className="er-preview-headline">{summary}</p>}

      {flows.length === 0 ? (
        <p className="er-form-hint">No business-flow signals from this execution.</p>
      ) : (
        <div className="er-flow-cards">
          {flows.map((f) => (
            <article key={f.flowName} className="er-flow-card">
              <header>
                <h4>{f.flowName}</h4>
                <span className={`er-risk-pill er-risk-pill--${f.riskScore >= 50 ? "high" : "medium"}`}>
                  Risk {f.riskScore}
                </span>
              </header>
              <ul>
                <li>Estimated pass rate: {f.passRatePercent ?? "—"}%</li>
                {f.impact && <li>{f.impact}</li>}
              </ul>
              {f.failedTests && f.failedTests.length > 0 && (
                <>
                  <h5>Failed tests</h5>
                  <ul>
                    {f.failedTests.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
