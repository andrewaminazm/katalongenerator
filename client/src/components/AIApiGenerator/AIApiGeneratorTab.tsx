import { ActionWithTip } from "../../FieldTip";
import { useAIApiGenerator } from "./AIApiGeneratorContext";
import { SwaggerUpload } from "./SwaggerUpload";
import { PostmanUpload } from "./PostmanUpload";
import { EndpointInput } from "./EndpointInput";
import { FieldBlock } from "../../FieldTip";

export function AIApiGeneratorTab() {
  const {
    inputMode,
    setInputMode,
    curlText,
    setCurlText,
    loading,
    postmanLoading,
    error,
    onGenerate,
    onGeneratePostman,
    onClear,
  } = useAIApiGenerator();

  const busy = loading || postmanLoading;

  return (
    <div className="stack" style={{ marginTop: "0.25rem" }}>
      <p className="hint">
        Generate Katalon API code and/or Postman collections from the same input — no live execution.
        Supports Swagger, cURL, endpoint JSON, and existing Postman imports.
      </p>

      <div className="tabs api-gen-input-tabs" role="tablist">
        {(
          [
            ["endpoint", "Endpoint"],
            ["swagger", "Swagger"],
            ["postman", "Postman"],
            ["curl", "cURL"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`tab ${inputMode === id ? "active" : ""}`}
            onClick={() => setInputMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {inputMode === "swagger" && <SwaggerUpload />}
      {inputMode === "postman" && <PostmanUpload />}
      {inputMode === "endpoint" && <EndpointInput />}
      {inputMode === "curl" && (
        <FieldBlock tip="Paste a cURL command from browser or Postman" label="cURL" htmlFor="api-curl">
          <textarea
            id="api-curl"
            className="input"
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            spellCheck={false}
            dir="ltr"
            style={{ minHeight: "8rem" }}
          />
        </FieldBlock>
      )}

      {error && <p className="status-msg error">{error}</p>}

      <div className="api-gen-actions">
        <div className="api-gen-actions__buttons">
          <ActionWithTip
            tip="Generate Katalon Groovy API tests, validations, negative/boundary cases, and helpers."
            tipPlacement="above"
            onClick={onGenerate}
            disabled={busy}
          >
            {loading ? "Generating…" : "Generate Katalon code"}
          </ActionWithTip>
          <ActionWithTip
            tip="Generate Postman Collection v2.1 with folders, tests, auth, environments, and negative/boundary requests."
            tipPlacement="above"
            onClick={onGeneratePostman}
            disabled={busy}
          >
            {postmanLoading && !loading ? "Generating…" : "Generate Postman Collection"}
          </ActionWithTip>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClear} disabled={busy}>
          Clear
        </button>
      </div>
    </div>
  );
}
