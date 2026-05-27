import { useMemo, useState } from "react";
import { TipIcon } from "../../FieldTip";
import { TIPS } from "../../fieldTips";
import { useAIApiGenerator } from "./AIApiGeneratorContext";
import { ValidationPreview } from "./ValidationPreview";
import { PostmanPreview } from "./PostmanPreview";

type OutputView = "katalon" | "postman";

export function GeneratedCodePanel() {
  const { loading, postmanLoading, result, postmanResult, testCaseName } = useAIApiGenerator();
  const files = result?.files ?? [];
  const [view, setView] = useState<OutputView>("katalon");
  const [activePath, setActivePath] = useState("");
  const [activeEnvId, setActiveEnvId] = useState("");

  const showPostman = view === "postman" && postmanResult;
  const showKatalon = view === "katalon" && result;

  const defaultPath = files.find((f) => f.kind === "script")?.path ?? files[0]?.path ?? "";
  const selectedPath = activePath && files.some((f) => f.path === activePath) ? activePath : defaultPath;
  const activeFile = files.find((f) => f.path === selectedPath);

  const katalonCode = activeFile?.content ?? result?.groovyCode ?? "";
  const postmanCode = useMemo(() => {
    if (!postmanResult) return "";
    if (activeEnvId) {
      const env = postmanResult.environments.find((e) => e.id === activeEnvId);
      if (env) return JSON.stringify({ name: env.name, values: env.values }, null, 2);
    }
    return postmanResult.collectionJson;
  }, [postmanResult, activeEnvId]);

  const displayCode = showPostman ? postmanCode : katalonCode;

  const allKatalon = useMemo(
    () => files.map((f) => `// ===== ${f.path} =====\n${f.content}`).join("\n\n"),
    [files]
  );

  const downloadBlob = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onCopy = () => {
    if (displayCode) void navigator.clipboard.writeText(displayCode);
  };

  const onCopyAllKatalon = () => {
    if (allKatalon) void navigator.clipboard.writeText(allKatalon);
  };

  const onDownloadKatalon = () => {
    if (!katalonCode || !activeFile) return;
    const name = activeFile.path.split("/").pop() ?? "ApiGenerated.groovy";
    const blob = new Blob([katalonCode], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onDownloadPostmanCollection = () => {
    if (!postmanResult) return;
    const safe = (testCaseName.trim() || "ApiCollection").replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadBlob(postmanResult.collectionJson, `${safe}.postman_collection.json`);
  };

  const onDownloadEnvironment = () => {
    if (!postmanResult?.environments.length) return;
    const env =
      postmanResult.environments.find((e) => e.id === activeEnvId) ?? postmanResult.environments[0];
    const safe = env.name.replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadBlob(
      JSON.stringify({ name: env.name, values: env.values }, null, 2),
      `${safe}.postman_environment.json`
    );
  };

  const hasAnyOutput = Boolean(result || postmanResult);

  return (
    <>
      <div className="code-panel-header">
        <span className="field-label">Generated output</span>
        <TipIcon tip={TIPS.tabApiGenerator} />
      </div>

      {(result || postmanResult) && (
        <div className="api-gen-view-tabs tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`tab ${view === "katalon" ? "active" : ""}`}
            disabled={!result}
            onClick={() => setView("katalon")}
          >
            Katalon
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${view === "postman" ? "active" : ""}`}
            disabled={!postmanResult}
            onClick={() => setView("postman")}
          >
            Postman
          </button>
        </div>
      )}

      <div className="code-toolbar">
        {view === "katalon" && files.length > 1 && (
          <select
            className="input btn-small"
            value={selectedPath}
            onChange={(e) => setActivePath(e.target.value)}
            aria-label="Select Katalon file"
          >
            {files.map((f) => (
              <option key={f.path} value={f.path}>
                {f.path}
              </option>
            ))}
          </select>
        )}
        {view === "postman" && postmanResult && postmanResult.environments.length > 0 && (
          <select
            className="input btn-small"
            value={activeEnvId || "collection"}
            onChange={(e) => setActiveEnvId(e.target.value === "collection" ? "" : e.target.value)}
            aria-label="Postman collection or environment"
          >
            <option value="collection">Collection JSON</option>
            {postmanResult.environments.map((e) => (
              <option key={e.id} value={e.id}>
                Env: {e.name}
              </option>
            ))}
          </select>
        )}
        <button type="button" className="btn btn-ghost btn-small" onClick={onCopy} disabled={!displayCode}>
          Copy
        </button>
        {view === "katalon" && (
          <>
            <button type="button" className="btn btn-ghost btn-small" onClick={onCopyAllKatalon} disabled={!files.length}>
              Copy all
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={onDownloadKatalon} disabled={!katalonCode}>
              Download Groovy
            </button>
          </>
        )}
        {view === "postman" && postmanResult && (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={onDownloadPostmanCollection}
            >
              Download Postman Collection
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={onDownloadEnvironment}
              disabled={!postmanResult.environments.length}
            >
              Download Environment
            </button>
          </>
        )}
      </div>

      {loading && <p className="hint">Generating Katalon API code…</p>}
      {postmanLoading && !loading && <p className="hint">Generating Postman collection…</p>}

      {!loading && !postmanLoading && !hasAnyOutput && (
        <p className="hint fa-empty">
          Katalon scripts (Scripts/API/) or Postman collection JSON appear here after generation.
        </p>
      )}

      {showKatalon && result && (
        <div className="api-gen-results">
          <ValidationPreview result={result} />
          {result.reusableHelpers.length > 0 && (
            <p className="hint api-gen-file-hint">
              Helpers: {result.reusableHelpers.join(", ")}
            </p>
          )}
          <pre className="code-pre api-gen-code" aria-live="polite">
            {katalonCode}
          </pre>
        </div>
      )}

      {showPostman && postmanResult && (
        <div className="api-gen-results">
          <PostmanPreview result={postmanResult} />
          <pre className="code-pre api-gen-code" aria-live="polite">
            {postmanCode}
          </pre>
        </div>
      )}
    </>
  );
}
