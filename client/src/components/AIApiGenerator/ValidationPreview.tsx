import type { ApiCodegenResult } from "../../api";

export function ValidationPreview({ result }: { result: ApiCodegenResult | null }) {
  if (!result?.preview) {
    return <p className="hint">After generation, discovered endpoints and validation strategy appear here.</p>;
  }

  const { preview, warnings, negativeTests, boundaryTests, requestObjects } = result;

  return (
    <div className="api-gen-preview stack">
      <div className="api-gen-preview-meta hint">
        <span>
          <strong>{preview.endpoints.length}</strong> endpoint(s) · Auth: <strong>{preview.authType}</strong> ·{" "}
          <strong>{preview.scenarioCount}</strong> scenario(s)
        </span>
        <p style={{ margin: "0.35rem 0 0" }}>{preview.validationStrategy}</p>
      </div>

      {preview.endpoints.length > 0 && (
        <div className="api-gen-card">
          <h3>Discovered endpoints</h3>
          <ul className="api-gen-endpoint-list">
            {preview.endpoints.map((e) => (
              <li key={`${e.method}-${e.path}-${e.name}`}>
                <code>
                  {e.method} {e.path}
                </code>
                {e.auth && e.auth !== "none" ? <span className="api-gen-tag">{e.auth}</span> : null}
                <span className="hint"> — {e.name}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {requestObjects.length > 0 && (
        <div className="api-gen-card">
          <h3>Request objects</h3>
          <ul className="api-gen-endpoint-list">
            {requestObjects.map((p) => (
              <li key={p}>
                <code>{p}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {negativeTests.length > 0 && (
        <div className="api-gen-card">
          <h3>Negative tests ({negativeTests.length})</h3>
          <ul className="api-gen-compact-list">
            {negativeTests.slice(0, 12).map((t) => (
              <li key={t}>{t}</li>
            ))}
            {negativeTests.length > 12 && <li className="hint">…and {negativeTests.length - 12} more</li>}
          </ul>
        </div>
      )}

      {boundaryTests.length > 0 && (
        <div className="api-gen-card">
          <h3>Boundary tests ({boundaryTests.length})</h3>
          <ul className="api-gen-compact-list">
            {boundaryTests.slice(0, 12).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="api-gen-card api-gen-warnings">
          <h3>Notes</h3>
          <ul className="api-gen-compact-list">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
