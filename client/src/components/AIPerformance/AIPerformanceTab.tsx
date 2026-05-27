import { ActionWithTip, CheckboxTip, FieldBlock } from "../../FieldTip";
import { TIPS } from "../../fieldTips";
import { useAIPerformance, type PerfInputMode } from "./AIPerformanceContext";
import type { PerformanceMode } from "../../api";

const MODES: { id: PerformanceMode; label: string }[] = [
  { id: "smoke", label: "Smoke" },
  { id: "baseline", label: "Baseline" },
  { id: "stress", label: "Stress" },
  { id: "spike", label: "Spike" },
  { id: "soak", label: "Soak" },
];

const DURATIONS = ["1m", "5m", "15m", "30m", "1h"];

export function AIPerformanceTab() {
  const {
    inputMode,
    setInputMode,
    swaggerText,
    setSwaggerText,
    postmanText,
    setPostmanText,
    curlText,
    setCurlText,
    endpointMethod,
    setEndpointMethod,
    endpointPath,
    setEndpointPath,
    endpointUrl,
    setEndpointUrl,
    requestJson,
    setRequestJson,
    responseJson,
    setResponseJson,
    suiteName,
    setSuiteName,
    mode,
    setMode,
    vus,
    setVus,
    duration,
    setDuration,
    rampUp,
    setRampUp,
    environment,
    setEnvironment,
    baseUrl,
    setBaseUrl,
    useProjectApis,
    setUseProjectApis,
    loading,
    error,
    onGenerateJmeter,
    onGenerateK6,
    onGenerateFull,
    onConvertPostman,
    onClear,
  } = useAIPerformance();

  const inputTabs: { id: PerfInputMode; label: string }[] = [
    ["endpoint", "Endpoint"],
    ["swagger", "Swagger"],
    ["postman", "Postman"],
    ["curl", "cURL"],
  ].map(([id, label]) => ({ id: id as PerfInputMode, label }));

  return (
    <div className="stack" style={{ marginTop: "0.25rem" }}>
      <p className="hint">{TIPS.tabPerformance}</p>

      <div className="tabs api-gen-input-tabs" role="tablist">
        {inputTabs.map(({ id, label }) => (
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

      {inputMode === "swagger" && (
        <FieldBlock tip="OpenAPI 3 JSON or YAML" label="Swagger / OpenAPI" htmlFor="perf-swagger">
          <textarea
            id="perf-swagger"
            className="input"
            value={swaggerText}
            onChange={(e) => setSwaggerText(e.target.value)}
            spellCheck={false}
            dir="ltr"
            style={{ minHeight: "8rem" }}
          />
        </FieldBlock>
      )}
      {inputMode === "postman" && (
        <FieldBlock tip="Postman Collection v2.1 JSON" label="Postman collection" htmlFor="perf-postman">
          <textarea
            id="perf-postman"
            className="input"
            value={postmanText}
            onChange={(e) => setPostmanText(e.target.value)}
            spellCheck={false}
            dir="ltr"
            style={{ minHeight: "8rem" }}
          />
        </FieldBlock>
      )}
      {inputMode === "curl" && (
        <FieldBlock tip="cURL from browser or Postman" label="cURL" htmlFor="perf-curl">
          <textarea
            id="perf-curl"
            className="input"
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            spellCheck={false}
            dir="ltr"
            style={{ minHeight: "6rem" }}
          />
        </FieldBlock>
      )}
      {inputMode === "endpoint" && (
        <div className="stack">
          <FieldBlock tip="Name used in JMeter test plan and k6 script header." label="Suite name" htmlFor="perf-suite-name">
            <input
              id="perf-suite-name"
              className="input"
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
            />
          </FieldBlock>
          <div className="row-2">
            <FieldBlock tip="HTTP method" label="Method" htmlFor="perf-method">
              <select
                id="perf-method"
                className="input"
                value={endpointMethod}
                onChange={(e) => setEndpointMethod(e.target.value)}
              >
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </FieldBlock>
            <FieldBlock tip="API path, e.g. /login" label="Path" htmlFor="perf-path">
              <input
                id="perf-path"
                className="input"
                value={endpointPath}
                onChange={(e) => setEndpointPath(e.target.value)}
                dir="ltr"
              />
            </FieldBlock>
          </div>
          <FieldBlock tip="Optional full URL instead of path" label="URL (optional)" htmlFor="perf-url">
            <input
              id="perf-url"
              className="input"
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://api.example.com/login"
              dir="ltr"
            />
          </FieldBlock>
          <FieldBlock tip="Example request body for parameterization" label="Request JSON" htmlFor="perf-req">
            <textarea
              id="perf-req"
              className="input"
              value={requestJson}
              onChange={(e) => setRequestJson(e.target.value)}
              spellCheck={false}
              dir="ltr"
            />
          </FieldBlock>
          <FieldBlock tip="Example response for correlation hints" label="Response JSON (optional)" htmlFor="perf-res">
            <textarea
              id="perf-res"
              className="input"
              value={responseJson}
              onChange={(e) => setResponseJson(e.target.value)}
              spellCheck={false}
              dir="ltr"
            />
          </FieldBlock>
        </div>
      )}

      <div className="stack perf-config-panel">
        <span className="field-label">Load configuration</span>
        <div className="tabs api-gen-input-tabs" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`tab ${mode === m.id ? "active" : ""}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="row-2">
          <FieldBlock tip="Target concurrent virtual users for baseline mode" label="Virtual users" htmlFor="perf-vus">
            <input
              id="perf-vus"
              type="number"
              min={1}
              max={5000}
              className="input"
              value={vus}
              onChange={(e) => setVus(Number(e.target.value) || 1)}
            />
          </FieldBlock>
          <FieldBlock tip="Maps to default base URL when not overridden" label="Environment" htmlFor="perf-env">
            <select
              id="perf-env"
              className="input"
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as typeof environment)}
            >
              <option value="local">Local</option>
              <option value="qa">QA</option>
              <option value="staging">Staging</option>
              <option value="production">Prod-like</option>
            </select>
          </FieldBlock>
        </div>
        <div className="row-2">
          <FieldBlock tip="Steady-state duration for load stages" label="Duration" htmlFor="perf-duration">
            <select
              id="perf-duration"
              className="input"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </FieldBlock>
          <FieldBlock tip="Time to reach target VUs, e.g. 30s" label="Ramp-up" htmlFor="perf-ramp">
            <input
              id="perf-ramp"
              className="input"
              value={rampUp}
              onChange={(e) => setRampUp(e.target.value)}
              placeholder="30s"
              dir="ltr"
            />
          </FieldBlock>
        </div>
        <FieldBlock tip="Override inferred server URL from OpenAPI or environment" label="Base URL (optional override)" htmlFor="perf-base-url">
          <input
            id="perf-base-url"
            className="input"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api-qa.example.com"
            dir="ltr"
          />
        </FieldBlock>
        <CheckboxTip
          tip="Merge indexed API RequestObjects from the active Katalon project with uploaded specs."
          checked={useProjectApis}
          onChange={setUseProjectApis}
          label="Use APIs from Project Intelligence"
        />
      </div>

      {error && <p className="status-msg error">{error}</p>}

      <div className="api-gen-actions">
        <div className="api-gen-actions__buttons">
          <ActionWithTip tip="JMeter .jmx test plan with thread groups, samplers, CSV, extractors." tipPlacement="above" onClick={onGenerateJmeter} disabled={loading}>
            {loading ? "Generating…" : "Generate JMeter (.jmx)"}
          </ActionWithTip>
          <ActionWithTip tip="k6 script with stages, setup auth, checks, and thresholds." tipPlacement="above" onClick={onGenerateK6} disabled={loading}>
            Generate k6 Script
          </ActionWithTip>
          <ActionWithTip tip="JMeter + k6 + performance strategy report." tipPlacement="above" onClick={onGenerateFull} disabled={loading}>
            Generate Full Suite
          </ActionWithTip>
          <ActionWithTip tip="Postman collection → load scenarios with chaining." tipPlacement="above" onClick={onConvertPostman} disabled={loading}>
            Convert Postman → Load Test
          </ActionWithTip>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onClear} disabled={loading}>
          Clear
        </button>
      </div>
    </div>
  );
}
