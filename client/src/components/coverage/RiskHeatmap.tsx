type Cell = {
  module: string;
  coverage: number;
  risk: number;
  assertionQuality: number;
};

function heatColor(coverage: number): string {
  if (coverage >= 75) return "color-mix(in srgb, var(--accent) 22%, var(--surface))";
  if (coverage >= 50) return "color-mix(in srgb, #e65100 15%, var(--surface))";
  return "color-mix(in srgb, var(--danger) 18%, var(--surface))";
}

export function RiskHeatmap({ cells }: { cells: Cell[] }) {
  if (!cells.length) {
    return <p className="cov-empty">No module heatmap data.</p>;
  }

  return (
    <div className="cov-heatmap" role="img" aria-label="Module coverage heatmap">
      {cells.map((c) => (
        <div
          key={c.module}
          className="cov-heat-cell"
          style={{ background: heatColor(c.coverage) }}
          title={`Coverage ${c.coverage}% · Risk ${c.risk} · Assertions ${c.assertionQuality}%`}
        >
          <strong>{c.module}</strong>
          <span>{c.coverage}% cov</span>
        </div>
      ))}
    </div>
  );
}
