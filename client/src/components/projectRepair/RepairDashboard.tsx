import type { ProjectRepairResult } from "../../api";
import { RepairDiffPanel } from "./RepairDiffPanel";

type Props = {
  result: ProjectRepairResult;
};

export function RepairDashboard({ result }: Props) {
  const h = result.frameworkHealth;

  return (
    <>
      <div className="pr-cards">
        <div className="pr-card">
          <p className="pr-card-label">Health</p>
          <p className="pr-card-value">{result.healthScore}</p>
        </div>
        <div className="pr-card">
          <p className="pr-card-label">Flakiness</p>
          <p className="pr-card-value">{result.flakinessScore}</p>
        </div>
        <div className="pr-card">
          <p className="pr-card-label">OR quality</p>
          <p className="pr-card-value">{h.locatorQualityScore}</p>
        </div>
        <div className="pr-card">
          <p className="pr-card-label">Assertions</p>
          <p className="pr-card-value">{h.assertionQualityScore}</p>
        </div>
        <div className="pr-card">
          <p className="pr-card-label">Architecture</p>
          <p className="pr-card-value">{h.architectureQualityScore}</p>
        </div>
        <div className="pr-card">
          <p className="pr-card-label">Suggestions</p>
          <p className="pr-card-value">{result.repairSuggestions.length}</p>
        </div>
      </div>

      <div className="pr-grid-2">
        <section className="pr-panel">
          <h2>Top repair suggestions</h2>
          <div className="pr-panel-body">
            {result.repairSuggestions.slice(0, 12).map((s) => (
              <div key={s.id} className="pr-suggestion">
                <strong>
                  [{s.category}] {s.title}
                </strong>
                <span className="pr-meta">
                  {s.severity} · priority {s.priority}
                  {s.autoApplicable ? " · auto-fix" : ""}
                </span>
                <p style={{ margin: "0.35rem 0 0" }}>{s.detail}</p>
                <p className="pr-meta">{s.suggestedFix}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pr-panel">
          <h2>Risk areas</h2>
          <div className="pr-panel-body">
            {result.riskAreas.length === 0 ? (
              <p className="pr-empty">No high-risk modules flagged.</p>
            ) : (
              <table style={{ width: "100%", fontSize: "var(--text-small)" }}>
                <thead>
                  <tr>
                    <th align="left">Module</th>
                    <th align="left">Risk</th>
                    <th align="left">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {result.riskAreas.map((r) => (
                    <tr key={r.module}>
                      <td>{r.module}</td>
                      <td>{r.riskScore}</td>
                      <td>{r.repairPriority}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <div className="pr-grid-2" style={{ marginTop: "1rem" }}>
        <section className="pr-panel">
          <h2>Locator repairs ({result.locatorRepairs.length})</h2>
          <div className="pr-panel-body">
            {result.locatorRepairs.slice(0, 10).map((l) => (
              <div key={l.orPath} className="pr-suggestion">
                <strong>{l.label}</strong>
                <span className="pr-meta">{l.orPath}</span>
                <p style={{ margin: "0.25rem 0" }}>{l.problem}</p>
                {l.newLocator && (
                  <p className="pr-meta">
                    Suggested: {l.newLocator.type} — {l.newLocator.value.slice(0, 80)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="pr-panel">
          <h2>Repair diffs</h2>
          <div className="pr-panel-body">
            <RepairDiffPanel diffs={result.repairDiffs} />
            {result.downloadableZip && (
              <p className="pr-meta" style={{ marginTop: "0.75rem" }}>
                Zip includes full project source with repaired scripts, <code>REPAIR_MANIFEST.md</code>, and{" "}
                <code>ai-repair/patches/</code> (original vs repaired per file).
              </p>
            )}
            {result.rollbackAvailable && result.rollbackId && (
              <p className="pr-meta" style={{ marginTop: "0.5rem" }}>
                Rollback id: <code>{result.rollbackId}</code>
              </p>
            )}
          </div>
        </section>
      </div>

      {result.warnings.length > 0 && (
        <p className="pr-meta" style={{ marginTop: "0.75rem" }}>
          {result.warnings.join(" · ")}
        </p>
      )}
    </>
  );
}
