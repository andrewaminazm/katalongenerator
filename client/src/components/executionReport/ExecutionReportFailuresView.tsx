import type { ExecutionReportOutput } from "../../api";
import { clusterFailuresByModule, getChartData } from "./executionReportViewUtils";

export function ExecutionReportFailuresView({ report }: { report: ExecutionReportOutput }) {
  const clusters = clusterFailuresByModule(getChartData(report).failedTestsTable);

  return (
    <div className="er-preview-panel">
      <h3>Failure Intelligence</h3>
      <p className="er-preview-headline">Failures clustered by module — business impact view</p>

      {clusters.length === 0 ? (
        <p className="er-form-hint">No failures recorded in this execution.</p>
      ) : (
        <div className="er-cluster-list">
          {clusters.map((c) => (
            <article key={c.module} className="er-cluster-card">
              <header>
                <h4>{c.module} failures</h4>
                <span className="er-cluster-count">{c.count} test(s)</span>
              </header>
              <p className="er-form-hint">
                Impact: {c.count >= 3 ? "High" : c.count >= 2 ? "Medium" : "Low"} — review module before release
              </p>
              <ul className="er-cluster-tests">
                {c.tests.map((t) => (
                  <li key={`${t.bugName}-${t.severity}`}>
                    <strong>{t.bugName}</strong> ({t.severity})
                    {t.jiraId ? ` — Jira: ${t.jiraId}` : ""}
                    {t.errorMessage
                      ? ` — ${t.errorMessage.slice(0, 120)}${t.errorMessage.length > 120 ? "…" : ""}`
                      : ""}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
