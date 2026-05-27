type Cell = {
  module: string;
  duplicationRisk: number;
  scriptCount: number;
};

type Props = {
  cells: Cell[];
};

export function DuplicationHeatmap({ cells }: Props) {
  if (cells.length === 0) {
    return <p className="ref-empty">No module duplication data.</p>;
  }
  const sorted = [...cells].sort((a, b) => b.duplicationRisk - a.duplicationRisk);
  return (
    <div>
      {sorted.map((c) => (
        <div key={c.module} className="ref-heatmap-row">
          <span style={{ minWidth: 100 }}>{c.module}</span>
          <div className="ref-heatmap-bar">
            <div
              className="ref-heatmap-fill"
              style={{ width: `${Math.min(100, c.duplicationRisk)}%` }}
            />
          </div>
          <span style={{ minWidth: 48 }}>{c.duplicationRisk}%</span>
          <span className="ref-rec-meta">{c.scriptCount} scripts</span>
        </div>
      ))}
    </div>
  );
}
