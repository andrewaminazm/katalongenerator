import { ActionWithTip } from "../../FieldTip";
import { useFailureAnalyzer } from "./FailureAnalyzerContext";
import { LogUploadPanel } from "./LogUploadPanel";

export function FailureAnalyzerInput() {
  const {
    inputs,
    setInputs,
    onScreenshotFile,
    screenshotPreview,
    loading,
    error,
    onAnalyze,
    onClear,
  } = useFailureAnalyzer();

  return (
    <div className="stack" style={{ marginTop: "0.25rem" }}>
      <p className="hint">
        Paste Katalon execution logs to infer root cause, flakiness, Object Repository issues, and
        suggested fixes. Stacktrace and screenshot are optional.
      </p>

      <LogUploadPanel
        values={inputs}
        onChange={(patch) => setInputs((v) => ({ ...v, ...patch }))}
        onScreenshotFile={onScreenshotFile}
        screenshotPreview={screenshotPreview}
      />

      {error && <p className="status-msg error">{error}</p>}

      <div className="row-actions">
        <ActionWithTip
          tip="Run Katalon-focused rule-based + Gosi Brain failure analysis on execution logs and stacktraces."
          onClick={onAnalyze}
          disabled={loading}
        >
          {loading ? "Analyzing…" : "Analyze failure"}
        </ActionWithTip>
        <button type="button" className="btn btn-ghost" onClick={onClear} disabled={loading}>
          Clear
        </button>
      </div>
    </div>
  );
}
