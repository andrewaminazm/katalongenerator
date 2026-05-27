import type { PostmanGenerateResult } from "../../api";

export function PostmanPreview({ result }: { result: PostmanGenerateResult }) {
  const info = result.collection.info as Record<string, unknown> | undefined;
  const name = typeof info?.name === "string" ? info.name : "Collection";

  return (
    <div className="api-gen-preview stack">
      <div className="api-gen-preview-meta hint">
        <span>
          <strong>{name}</strong> · Postman v2.1 · <strong>{result.generatedTests.length}</strong>{" "}
          test script(s) · <strong>{result.environments.length}</strong> environment(s)
        </span>
      </div>

      {result.warnings.length > 0 && (
        <div className="api-gen-card api-gen-warnings">
          <h3>Notes</h3>
          <ul className="api-gen-compact-list">
            {result.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {result.environments.length > 0 && (
        <div className="api-gen-card">
          <h3>Environments</h3>
          <ul className="api-gen-compact-list">
            {result.environments.map((e) => (
              <li key={e.id}>
                {e.name} — {e.values.map((v) => v.key).join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
