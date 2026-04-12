import { useCallback, useEffect, useMemo, useState } from "react";
import {
  clearHistory,
  extractLocatorsFromUrl,
  fetchHistory,
  fetchJiraIssue,
  generateCode,
  generateCodeStream,
  healthCheck,
  parseCsv,
  cancelRecordingOnServer,
  recordTestFlow,
  type HistoryEntry,
  type Platform,
} from "./api";
import "./App.css";

type InputTab = "manual" | "csv" | "jira" | "record";

const MODELS = [
  { value: "llama3.2", label: "llama3.2 (default)" },
  { value: "llama3", label: "llama3" },
  { value: "codellama", label: "codellama (code)" },
  { value: "qwen3-coder:30b", label: "qwen3-coder:30b (code)" },
];

function splitSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function App() {
  const [tab, setTab] = useState<InputTab>("manual");
  const [manualSteps, setManualSteps] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvSteps, setCsvSteps] = useState<string[]>([]);
  const [jiraKey, setJiraKey] = useState("PROJ-123");
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  const [jiraSteps, setJiraSteps] = useState<string[]>([]);
  const [jiraMeta, setJiraMeta] = useState<{ mock: boolean; summary: string } | null>(null);
  const [jiraLoading, setJiraLoading] = useState(false);

  const [recordUrl, setRecordUrl] = useState("https://example.com");
  const [recordStepsText, setRecordStepsText] = useState("");
  const [recordLocatorsText, setRecordLocatorsText] = useState("");
  const [recordPlaywrightScript, setRecordPlaywrightScript] = useState("");
  const [recordLoading, setRecordLoading] = useState(false);

  const [platform, setPlatform] = useState<Platform>("web");
  const [model, setModel] = useState("llama3.2");
  const [locators, setLocators] = useState("");
  const [locatorUrl, setLocatorUrl] = useState("https://example.com");
  const [autoDetectLocators, setAutoDetectLocators] = useState(false);
  const [autoPreview, setAutoPreview] = useState<string | null>(null);
  const [fetchingLocators, setFetchingLocators] = useState(false);
  const [testCaseName, setTestCaseName] = useState("TC_Login_Smoke");
  const [useStream, setUseStream] = useState(false);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    if (platform === "mobile" && tab === "record") {
      setTab("manual");
    }
  }, [platform, tab]);

  const loadHistory = useCallback(async () => {
    try {
      const entries = await fetchHistory();
      setHistory(entries);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    healthCheck()
      .then((h) => setHealth(`${h.ollamaBase} · default ${h.defaultModel}`))
      .catch(() => setHealth("API unreachable — start the backend"));
    loadHistory();
  }, [loadHistory]);

  const effectiveSteps = useMemo(() => {
    if (tab === "manual") return splitSteps(manualSteps);
    if (tab === "csv") return csvSteps;
    if (tab === "jira") return jiraSteps;
    return splitSteps(recordStepsText);
  }, [tab, manualSteps, csvSteps, jiraSteps, recordStepsText]);

  const onCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setError(null);
    try {
      const { steps } = await parseCsv(file);
      setCsvSteps(steps);
    } catch (err) {
      setCsvSteps([]);
      setError(err instanceof Error ? err.message : "CSV parse failed");
    }
  };

  const onRecordFlow = async () => {
    setError(null);
    if (!recordUrl.trim()) {
      setError("Enter a URL to record.");
      return;
    }
    if (platform !== "web") {
      setError('Switch platform to "Web" to use recording.');
      return;
    }
    setRecordLoading(true);
    try {
      const r = await recordTestFlow(recordUrl.trim(), (u) => setRecordUrl(u));
      setRecordPlaywrightScript(r.playwrightScript);
      setRecordStepsText(r.steps.join("\n"));
      setRecordLocatorsText(r.locators.map((l) => `${l.name} = ${l.selector}`).join("\n"));
      setManualSteps(r.steps.join("\n"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recording failed");
    } finally {
      setRecordLoading(false);
    }
  };

  const onFetchJira = async () => {
    setError(null);
    const key = jiraKey.trim();
    if (!key) {
      setError("Enter a Jira issue key.");
      return;
    }
    const b = jiraBaseUrl.trim();
    const e = jiraEmail.trim();
    const t = jiraApiToken.trim();
    const partial = [b, e, t].filter(Boolean).length;
    if (partial > 0 && partial < 3) {
      setError("Fill in Jira URL, email, and API token together, or leave all three empty for demo steps.");
      return;
    }
    setJiraLoading(true);
    try {
      const creds =
        b && e && t ? { baseUrl: b, email: e, apiToken: t } : undefined;
      const r = await fetchJiraIssue(key, creds);
      setJiraSteps(r.steps);
      setJiraMeta({ mock: r.mock, summary: r.summary });
      setManualSteps(r.steps.join("\n"));
    } catch (err) {
      setJiraSteps([]);
      setJiraMeta(null);
      setError(err instanceof Error ? err.message : "Jira fetch failed");
    } finally {
      setJiraLoading(false);
    }
  };

  const onGenerate = async () => {
    setError(null);
    if (tab === "record") {
      if (platform !== "web") {
        setError('Recording-based generation requires platform "Web".');
        return;
      }
      if (!recordPlaywrightScript.trim() && !recordUrl.trim()) {
        setError("Record a flow first (or enter a URL to re-record on generate), or add steps in the fields below.");
        return;
      }
    }
    if (effectiveSteps.length === 0) {
      setError("Add at least one test step.");
      return;
    }
    if (autoDetectLocators && !locatorUrl.trim()) {
      setError("Enter a page URL or turn off auto-detect locators.");
      return;
    }
    setLoading(true);
    setOutput("");
    try {
      const mergedLocators =
        tab === "record" && recordLocatorsText.trim()
          ? [locators.trim(), recordLocatorsText.trim()].filter(Boolean).join("\n")
          : locators;

      let urlForGenerate: string | undefined;
      if (tab === "record" && platform === "web") {
        if (!recordPlaywrightScript.trim() && recordUrl.trim()) {
          urlForGenerate = recordUrl.trim();
        }
      } else if (autoDetectLocators && locatorUrl.trim()) {
        urlForGenerate = locatorUrl.trim();
      }

      const payload = {
        platform,
        steps: effectiveSteps,
        locators: mergedLocators,
        model,
        testCaseName: testCaseName.trim() || undefined,
        autoDetectLocators:
          tab !== "record" && autoDetectLocators && Boolean(locatorUrl.trim()),
        url: urlForGenerate,
        ...(tab === "record" && platform === "web"
          ? {
              mode: "record" as const,
              recordedPlaywrightScript: recordPlaywrightScript.trim() || undefined,
            }
          : {}),
      };
      if (useStream) {
        await generateCodeStream(payload, (chunk) => {
          setOutput((prev) => prev + chunk);
        });
      } else {
        const r = await generateCode(payload);
        setOutput(r.code);
      }
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const onCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
  };

  const onDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    const base = (testCaseName.trim() || "KatalonGenerated").replace(/[^a-z0-9_-]/gi, "_");
    a.href = URL.createObjectURL(blob);
    a.download = `${base}.groovy`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onFetchLocatorsPreview = async () => {
    setError(null);
    if (!locatorUrl.trim()) {
      setError("Enter a URL to extract locators.");
      return;
    }
    setFetchingLocators(true);
    setAutoPreview(null);
    try {
      const list = await extractLocatorsFromUrl(locatorUrl.trim());
      setAutoPreview(
        list.map((x) => `${x.name} = ${x.selector}`).join("\n") || "(no elements found)"
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Locator extraction failed");
    } finally {
      setFetchingLocators(false);
    }
  };

  const onClearHistory = async () => {
    try {
      await clearHistory();
      await loadHistory();
    } catch {
      setError("Could not clear history");
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Katalon script generator (Ollama)</h1>
          <p className="hint" style={{ margin: "0.25rem 0 0" }}>
            Local LLM only — no cloud APIs. Backend proxies{" "}
            <code>/api/generate</code> → Ollama.
          </p>
        </div>
        <div className="header-meta">
          {health && <span className="badge">{health}</span>}
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setDark((d) => !d)}
            aria-label="Toggle dark mode"
          >
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </header>

      <div className="app-body">
        <section className="panel">
          <div className="tabs" role="tablist">
            <button
              type="button"
              className={`tab ${tab === "manual" ? "active" : ""}`}
              onClick={() => setTab("manual")}
            >
              Manual
            </button>
            <button
              type="button"
              className={`tab ${tab === "csv" ? "active" : ""}`}
              onClick={() => setTab("csv")}
            >
              CSV
            </button>
            <button
              type="button"
              className={`tab ${tab === "jira" ? "active" : ""}`}
              onClick={() => setTab("jira")}
            >
              Jira
            </button>
            <button
              type="button"
              className={`tab ${tab === "record" ? "active" : ""}`}
              onClick={() => setTab("record")}
              disabled={platform === "mobile"}
              title={platform === "mobile" ? "Recording is available for Web only" : undefined}
            >
              Record
            </button>
          </div>

          {tab === "manual" && (
            <div className="stack">
              <div>
                <label className="field-label" htmlFor="steps">
                  Test steps (one per line)
                </label>
                <textarea
                  id="steps"
                  className="input"
                  value={manualSteps}
                  onChange={(e) => setManualSteps(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          {tab === "csv" && (
            <div className="stack">
              <div>
                <label className="field-label" htmlFor="csv">
                  CSV file (columns: Step, Description)
                </label>
                <input id="csv" type="file" accept=".csv,text/csv" onChange={onCsv} />
              </div>
              {csvFileName && (
                <p className="hint">
                  Loaded <strong>{csvFileName}</strong> — {csvSteps.length} step(s).
                </p>
              )}
            </div>
          )}

          {tab === "jira" && (
            <div className="stack">
              <div>
                <label className="field-label" htmlFor="jiraBase">
                  Jira base URL
                </label>
                <input
                  id="jiraBase"
                  className="input"
                  type="url"
                  autoComplete="url"
                  placeholder="https://your-domain.atlassian.net"
                  value={jiraBaseUrl}
                  onChange={(e) => setJiraBaseUrl(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="jiraEmail">
                  Email (Atlassian account)
                </label>
                <input
                  id="jiraEmail"
                  className="input"
                  type="email"
                  autoComplete="username"
                  placeholder="you@company.com"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="jiraToken">
                  API token
                </label>
                <input
                  id="jiraToken"
                  className="input"
                  type="password"
                  autoComplete="off"
                  placeholder="Create at id.atlassian.com → API tokens"
                  value={jiraApiToken}
                  onChange={(e) => setJiraApiToken(e.target.value)}
                />
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label" htmlFor="jira">
                    Issue key
                  </label>
                  <input
                    id="jira"
                    className="input"
                    value={jiraKey}
                    onChange={(e) => setJiraKey(e.target.value)}
                    spellCheck={false}
                  />
                </div>
                <div style={{ alignSelf: "flex-end" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onFetchJira}
                    disabled={jiraLoading}
                  >
                    {jiraLoading ? "Fetching…" : "Fetch from Jira"}
                  </button>
                </div>
              </div>
              <p className="hint">
                Leave URL, email, and token empty to load <strong>demo</strong> steps only. Credentials are sent per
                request and are not stored on the server.
              </p>
              {jiraMeta && (
                <p className="hint">
                  {jiraMeta.mock ? "Demo data (no credentials sent). " : "Live Jira issue. "}
                  <strong>{jiraMeta.summary}</strong> — {jiraSteps.length} step(s). Manual tab was updated with the same
                  steps.
                </p>
              )}
            </div>
          )}

          {tab === "record" && (
            <div className="stack">
              <p className="hint">
                Opens a real Chromium window on the <strong>machine running the backend</strong>. Use{" "}
                <strong>Finish recording</strong> in the page when done (or wait for the session timeout).
              </p>
              <div>
                <label className="field-label" htmlFor="recordUrl">
                  URL to open
                </label>
                <input
                  id="recordUrl"
                  className="input"
                  type="url"
                  value={recordUrl}
                  onChange={(e) => setRecordUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onRecordFlow}
                  disabled={recordLoading || platform === "mobile"}
                >
                  {recordLoading ? "Recording session…" : "Record test flow"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost record-cancel"
                  onClick={async () => {
                    setError(null);
                    try {
                      await cancelRecordingOnServer();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not cancel recording");
                    }
                  }}
                  disabled={platform === "mobile"}
                  title="Clears a stuck session if you closed the browser or refreshed the page"
                >
                  Cancel recording on server
                </button>
              </div>
              <div>
                <label className="field-label" htmlFor="pwScript">
                  Playwright-style script (editable)
                </label>
                <textarea
                  id="pwScript"
                  className="input"
                  rows={6}
                  value={recordPlaywrightScript}
                  onChange={(e) => setRecordPlaywrightScript(e.target.value)}
                  spellCheck={false}
                  placeholder="Populated after recording…"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="recSteps">
                  Steps (editable)
                </label>
                <textarea
                  id="recSteps"
                  className="input"
                  rows={6}
                  value={recordStepsText}
                  onChange={(e) => setRecordStepsText(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="recLoc">
                  Locators (editable, name = selector per line)
                </label>
                <textarea
                  id="recLoc"
                  className="input"
                  rows={5}
                  value={recordLocatorsText}
                  onChange={(e) => setRecordLocatorsText(e.target.value)}
                  spellCheck={false}
                />
              </div>
            </div>
          )}

          <div className="stack" style={{ marginTop: "1rem" }}>
            <div className="row-2">
              <div>
                <label className="field-label" htmlFor="platform">
                  Platform
                </label>
                <select
                  id="platform"
                  className="input"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                >
                  <option value="web">Web (WebUI)</option>
                  <option value="mobile">Mobile (Mobile)</option>
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="model">
                  Ollama model
                </label>
                <select
                  id="model"
                  className="input"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                >
                  {MODELS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="name">
                Test case name (optional)
              </label>
              <input
                id="name"
                className="input"
                value={testCaseName}
                onChange={(e) => setTestCaseName(e.target.value)}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="locators">
                Locators (label = Object Repository path or CSS, one per line)
              </label>
              <textarea
                id="locators"
                className="input"
                value={locators}
                onChange={(e) => setLocators(e.target.value)}
                spellCheck={false}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="locatorUrl">
                Page URL (for Playwright auto-detect)
              </label>
              <input
                id="locatorUrl"
                className="input"
                type="url"
                value={locatorUrl}
                onChange={(e) => setLocatorUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={autoDetectLocators}
                onChange={(e) => setAutoDetectLocators(e.target.checked)}
              />
              Auto-detect locators (Playwright) when generating — merges with manual list; manual labels win
            </label>

            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={onFetchLocatorsPreview}
                disabled={fetchingLocators}
              >
                {fetchingLocators ? "Fetching…" : "Preview locators from URL"}
              </button>
            </div>
            {autoPreview !== null && (
              <div>
                <label className="field-label">Last preview (not saved until you generate)</label>
                <textarea className="input" readOnly value={autoPreview} rows={6} spellCheck={false} />
              </div>
            )}

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={useStream}
                onChange={(e) => setUseStream(e.target.checked)}
              />
              Stream response (live typing; uses Ollama streaming API)
            </label>

            {error && (
              <div className="error-block">
                <p className="status-msg error">{error}</p>
                {/already in progress/i.test(error) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={async () => {
                      try {
                        await cancelRecordingOnServer();
                        setError(null);
                      } catch (err) {
                        setError(
                          err instanceof Error ? err.message : "Could not clear recording session"
                        );
                      }
                    }}
                  >
                    Clear stuck recording session
                  </button>
                )}
              </div>
            )}

            <button
              type="button"
              className="btn btn-primary"
              onClick={onGenerate}
              disabled={loading}
            >
              {loading ? "Generating…" : "Generate Katalon Groovy"}
            </button>

            <p className="hint">
              Steps in use: {effectiveSteps.length}. Ensure Ollama is running (
              <code>ollama serve</code>) and the model is pulled (
              <code>ollama pull {model}</code>).
            </p>
          </div>

          <div className="history">
            <h2>Recent generations (server)</h2>
            <button type="button" className="btn btn-ghost btn-small" onClick={onClearHistory}>
              Clear history
            </button>
            <ul className="history-list">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="history-item"
                  onClick={() => setOutput(h.code)}
                  title="Click to load into editor"
                >
                  <strong>{h.testCaseName || "Untitled"}</strong> · {h.platform} · {h.model}
                  <small>{new Date(h.createdAt).toLocaleString()} — {h.stepsPreview.slice(0, 80)}…</small>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="panel code-panel">
          <div className="code-toolbar">
            <button type="button" className="btn btn-ghost btn-small" onClick={onCopy} disabled={!output}>
              Copy
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={onDownload}
              disabled={!output}
            >
              Download .groovy
            </button>
          </div>
          <pre className="code-pre" aria-live="polite">
            {output || (loading ? "…" : "// Generated Groovy appears here")}
          </pre>
        </section>
      </div>
    </div>
  );
}
