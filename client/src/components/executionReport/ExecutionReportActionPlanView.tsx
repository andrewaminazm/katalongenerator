import type { ExecutionReportOutput } from "../../api";

export function ExecutionReportActionPlanView({ report }: { report: ExecutionReportOutput }) {
  const es = report.executiveSummary;
  const rr = report.releaseReadiness;
  const critical = es.severityCounts?.CRITICAL ?? 0;

  const p0: string[] = [];
  if (critical > 0) p0.push(`Resolve ${critical} CRITICAL failure(s) before any production deploy`);
  p0.push(...rr.blockingIssues);

  const p1 = report.recommendations.slice(0, 5);
  const p2 = [
    "Stabilize top failing module automation and add contract checks for API failures",
    "Compare with last green build if pass rate dropped sharply",
  ];
  const p3 = ["Enable build-over-build trend storage for regression detection", "Review flaky candidates in next sprint"];

  return (
    <div className="er-preview-panel">
      <h3>Engineering Action Plan</h3>
      <p className="er-preview-headline">Prioritized by business value — release blockers first</p>

      <section className="er-action-block er-action-p0">
        <h4>P0 — Release blockers</h4>
        {p0.length === 0 ? (
          <p className="er-form-hint">No P0 blockers in this snapshot.</p>
        ) : (
          <ul>
            {p0.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="er-action-block er-action-p1">
        <h4>P1 — Critical improvements</h4>
        {p1.length === 0 ? (
          <p className="er-form-hint">No P1 items — maintain monitoring.</p>
        ) : (
          <ul>
            {p1.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="er-action-block">
        <h4>P2 — High value improvements</h4>
        <ul>
          {p2.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="er-action-block">
        <h4>P3 — Optimization</h4>
        <ul>
          {p3.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
