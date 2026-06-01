import type { ExecutionReportOutput } from "../../api";
import { getModuleRows } from "./executionReportViewUtils";

export function ExecutionReportModulesView({ report }: { report: ExecutionReportOutput }) {
  const modules = [...getModuleRows(report)].sort((a, b) => a.riskScore - b.riskScore);
  const summary = (report.moduleRiskAnalysis as { summary?: string })?.summary;

  return (
    <div className="er-preview-panel">
      <h3>Module Health Dashboard</h3>
      {summary && <p className="er-preview-headline">{summary}</p>}

      {modules.length === 0 ? (
        <p className="er-form-hint">No module-level failures — all modules healthy in this run.</p>
      ) : (
        <table className="er-data-table">
          <thead>
            <tr>
              <th>Module</th>
              <th>Quality</th>
              <th>Failures</th>
              <th>Stability</th>
              <th>Risk</th>
              <th>Dominant type</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => {
              const quality = Math.max(0, 100 - m.riskScore);
              const riskLabel = m.riskScore >= 70 ? "High" : m.riskScore >= 40 ? "Medium" : "Low";
              return (
                <tr key={m.module}>
                  <td>{m.module}</td>
                  <td>{quality}</td>
                  <td>{m.failureCount}</td>
                  <td>{m.stabilityScore}</td>
                  <td>
                    <span className={`er-risk-pill er-risk-pill--${riskLabel.toLowerCase()}`}>{riskLabel}</span>{" "}
                    ({m.riskScore})
                  </td>
                  <td>{m.dominantFailureType}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <p className="er-form-hint">Sorted healthiest → riskiest (lowest risk score first).</p>
    </div>
  );
}
