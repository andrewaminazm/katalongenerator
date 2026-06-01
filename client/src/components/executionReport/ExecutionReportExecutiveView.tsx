import type { ExecutionReportOutput } from "../../api";

function parseExecutiveSections(markdown: string): Array<{ title: string; body: string }> {
  const chunks = markdown.split(/^## /m).filter(Boolean);
  if (chunks.length <= 1 && !markdown.includes("## SECTION")) {
    return [{ title: "Report", body: markdown.trim() }];
  }
  return chunks.map((chunk) => {
    const nl = chunk.indexOf("\n");
    const title = nl === -1 ? chunk.trim() : chunk.slice(0, nl).trim();
    const body = nl === -1 ? "" : chunk.slice(nl + 1).trim();
    return { title, body };
  });
}

export function ExecutionReportExecutiveView({ report }: { report: ExecutionReportOutput }) {
  const intel = report.executiveIntelligence;

  if (!intel) {
    return (
      <div className="er-preview-panel er-preview-empty">
        <p>
          Executive QA Intelligence was not generated for this run. Keep the <strong>Executive</strong> tab
          selected and click <strong>Generate report</strong> again (Executive and Release types request the
          full narrative from the server).
        </p>
      </div>
    );
  }

  const dep = intel.deploymentRecommendation;
  const sections = parseExecutiveSections(intel.markdown);

  return (
    <div className="er-preview-panel er-executive-view">
      <div className="er-executive-hero">
        <h3>Executive QA Intelligence</h3>
        <p className="er-executive-meta">
          Director: <strong>{intel.directorStatus}</strong>
          {" · "}
          Deployment: <strong>{dep.decision}</strong>
          {" · "}
          Confidence: {dep.confidencePercent}%
          {" · "}
          Source: {intel.generatedBy}
          {intel.model ? ` (${intel.model})` : ""}
        </p>
      </div>

      <div className="er-deployment-card">
        <span className="er-deployment-label">Section 12 — Deployment</span>
        <p className="er-deployment-decision">{dep.decision}</p>
        <p>{dep.reasoning}</p>
        {dep.majorRisks.length > 0 && (
          <>
            <h5>Major risks</h5>
            <ul>
              {dep.majorRisks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        )}
        {dep.requiredActions.length > 0 && (
          <>
            <h5>Required actions</h5>
            <ul>
              {dep.requiredActions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="er-executive-sections">
        {sections.map((sec) => (
          <article key={sec.title} className="er-executive-section">
            <h4>{sec.title}</h4>
            <pre className="er-executive-section-body">{sec.body}</pre>
          </article>
        ))}
      </div>
    </div>
  );
}
