import { useMemo, useState } from "react";
import { TipIcon } from "../../FieldTip";
import { TIPS } from "../../fieldTips";
import { useAIPerformance } from "./AIPerformanceContext";

type OutputView = "jmeter" | "k6" | "strategy";

export function PerformanceOutputPanel() {
  const { loading, result, suiteName } = useAIPerformance();
  const [view, setView] = useState<OutputView>("jmeter");

  const displayCode = useMemo(() => {
    if (!result) return "";
    if (view === "jmeter") return result.jmeter;
    if (view === "k6") return result.k6;
    return JSON.stringify(result.strategy, null, 2);
  }, [result, view]);

  const download = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const safeName = (suiteName.trim() || "PerfSuite").replace(/[^a-zA-Z0-9_-]/g, "_");

  return (
    <>
      <div className="code-panel-header">
        <span className="field-label">Performance output</span>
        <TipIcon tip={TIPS.tabPerformance} />
      </div>

      {result && (
        <div className="api-gen-view-tabs tabs" role="tablist">
          <button
            type="button"
            role="tab"
            className={`tab ${view === "jmeter" ? "active" : ""}`}
            disabled={!result.jmeter}
            onClick={() => setView("jmeter")}
          >
            JMeter
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${view === "k6" ? "active" : ""}`}
            disabled={!result.k6}
            onClick={() => setView("k6")}
          >
            k6
          </button>
          <button
            type="button"
            role="tab"
            className={`tab ${view === "strategy" ? "active" : ""}`}
            onClick={() => setView("strategy")}
          >
            Strategy
          </button>
        </div>
      )}

      <div className="code-toolbar">
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => displayCode && void navigator.clipboard.writeText(displayCode)}
          disabled={!displayCode}
        >
          Copy
        </button>
        {result?.jmeter && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => download(result.jmeter, `${safeName}.jmx`, "application/xml")}
          >
            Download .jmx
          </button>
        )}
        {result?.k6 && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() => download(result.k6, `${safeName}.js`, "text/javascript")}
          >
            Download k6
          </button>
        )}
        {result?.strategy && (
          <button
            type="button"
            className="btn btn-ghost btn-small"
            onClick={() =>
              download(JSON.stringify(result.strategy, null, 2), `${safeName}-strategy.json`, "application/json")
            }
          >
            Download strategy
          </button>
        )}
      </div>

      {result && (
        <p className="hint" style={{ marginBottom: "0.5rem" }}>
          {result.endpointCount} endpoint(s) · base URL <code>{result.baseUrl}</code>
          {result.warnings.length > 0 && (
            <>
              <br />
              {result.warnings.map((w, i) => (
                <span key={i}>
                  {w}
                  <br />
                </span>
              ))}
            </>
          )}
        </p>
      )}

      {view === "strategy" && result?.strategy.scenarios.length ? (
        <div className="perf-scenario-list stack" style={{ marginBottom: "0.75rem" }}>
          <span className="field-label">Scenario mapping</span>
          <ul className="perf-scenarios">
            {result.strategy.scenarios.map((s) => (
              <li key={s.id}>
                <strong>{s.name}</strong> — {s.vus} VUs, {s.duration}, ramp {s.rampUp}
                <br />
                <small>{s.endpoints.join(" · ")}</small>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <pre className="code-pre" aria-live="polite" style={{ minHeight: "12rem" }}>
        {loading ? "Generating performance suite…" : displayCode || "Generate JMeter, k6, or the full suite to preview output."}
      </pre>
    </>
  );
}
