import type { ProjectRepairDiff } from "../../api";

type Props = {
  diffs: ProjectRepairDiff[];
};

export function RepairDiffPanel({ diffs }: Props) {
  if (diffs.length === 0) {
    return <p className="pr-empty">No repair diffs yet — run Preview repairs or Apply safe repairs.</p>;
  }

  return (
    <>
      {diffs.slice(0, 8).map((d) => (
        <div key={`${d.filePath}-${d.suggestionId}`} className="pr-suggestion">
          <strong>{d.filePath}</strong>
          <span className="pr-meta">
            {d.category} · {d.changed ? "changed" : "unchanged"} · lint{" "}
            {d.lintPassed ? "ok" : "review"}
          </span>
          <ul className="pr-meta" style={{ margin: "0.35rem 0", paddingLeft: "1rem" }}>
            {d.diffSummary.slice(0, 5).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {d.changed && (
            <div className="pr-diff" style={{ marginTop: "0.5rem" }}>
              <p className="pr-meta">Repaired preview (first 40 lines)</p>
              <pre>{d.repaired.split(/\r?\n/).slice(0, 40).join("\n")}</pre>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
