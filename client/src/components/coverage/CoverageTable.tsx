type Row = {
  module: string;
  coverageScore: number;
  riskLevel: string;
  assertionScore: number;
  testScriptCount: number;
};

export function CoverageTable({ rows }: { rows: Row[] }) {
  if (!rows.length) {
    return <p className="cov-empty">No modules scored yet.</p>;
  }

  return (
    <table className="cov-table">
      <thead>
        <tr>
          <th>Module</th>
          <th>Coverage</th>
          <th>Risk</th>
          <th>Assertions</th>
          <th>Scripts</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.module}>
            <td>{r.module}</td>
            <td>{r.coverageScore}%</td>
            <td>
              <span className={`cov-sev cov-sev--${r.riskLevel}`}>{r.riskLevel}</span>
            </td>
            <td>{r.assertionScore}%</td>
            <td>{r.testScriptCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
