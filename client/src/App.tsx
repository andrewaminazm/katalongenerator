import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearHistory,
  convertLocatorsApi,
  fetchPlaywrightLocatorsPreview,
  fetchHistory,
  fetchJiraIssue,
  generateCode,
  generateCodeStream,
  healthCheck,
  parseCsv,
  type ConvertLocatorResultItem,
  type CsvTestCaseRow,
  cancelRecordingOnServer,
  recordTestFlow,
  exportToKatalonProject,
  mobileStartSession,
  mobileStopSession,
  mobileExtractLocators,
  mobileRecordStart,
  mobileRecordStop,
  type HistoryEntry,
  type LintIssue,
  type LlmProvider,
  type Platform,
  type PlaywrightPageLocale,
  type StylePass,
} from "./api";
import "./App.css";

type InputTab = "manual" | "csv" | "jira" | "record";

const OLLAMA_MODELS = [
  { value: "llama3.2", label: "llama3.2 (default)" },
  { value: "llama3", label: "llama3" },
  { value: "codellama", label: "codellama (code)" },
  { value: "qwen3-coder:30b", label: "qwen3-coder:30b (code)" },
];

const GEMINI_MODELS = [
  { value: "gemini-2.0-flash", label: "gemini-2.0-flash (default)" },
  { value: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite" },
  { value: "gemini-1.5-flash", label: "gemini-1.5-flash" },
  { value: "gemini-1.5-pro", label: "gemini-1.5-pro" },
];

function splitSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Append recorded `name = selector` lines to the shared locators box (used after Record). */
function mergeLocatorBlock(existing: string, added: string): string {
  const e = existing.trim();
  const a = added.trim();
  if (!a) return e;
  if (!e) return a;
  return `${e}\n${a}`;
}

/** Lines for conversion: manual Locators field first, then Playwright preview (later duplicates win on server). */
function mergeLocatorLinesForConvert(manual: string, preview: string | null): string[] {
  const lines: string[] = [];
  for (const l of manual.split(/\r?\n/)) {
    const t = l.trim();
    if (t && !t.startsWith("#")) lines.push(t);
  }
  if (preview) {
    for (const l of preview.split(/\r?\n/)) {
      const t = l.trim();
      if (t && !t.startsWith("#")) lines.push(t);
    }
  }
  return lines;
}

function FieldClearBelow({
  onClear,
  disabled,
}: {
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="field-clear-row">
      <button type="button" className="btn btn-ghost btn-small" onClick={onClear} disabled={disabled}>
        Clear
      </button>
    </div>
  );
}

export default function App() {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<InputTab>("manual");
  const [manualSteps, setManualSteps] = useState("");
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const [csvSteps, setCsvSteps] = useState<string[]>([]);
  const [csvFormat, setCsvFormat] = useState<"simple" | "test-cases" | null>(null);
  const [csvTestCaseRows, setCsvTestCaseRows] = useState<CsvTestCaseRow[]>([]);
  const [csvSelectedRowIndexes, setCsvSelectedRowIndexes] = useState<number[]>([]);
  const [jiraKey, setJiraKey] = useState("PROJ-123");
  const [jiraBaseUrl, setJiraBaseUrl] = useState("");
  const [jiraEmail, setJiraEmail] = useState("");
  const [jiraApiToken, setJiraApiToken] = useState("");
  /** Lines from Jira (or demo); editable — this is what Generate sends to the engine. */
  const [jiraStepsText, setJiraStepsText] = useState("");
  const [jiraMeta, setJiraMeta] = useState<{ mock: boolean; summary: string } | null>(null);
  const [jiraLoading, setJiraLoading] = useState(false);

  const [recordUrl, setRecordUrl] = useState("");
  const [recordPlaywrightScript, setRecordPlaywrightScript] = useState("");
  const [recordLoading, setRecordLoading] = useState(false);
  /** When true, server keeps full trace (no dedupe / no intent inserts / strict count). Default on. */
  const [preserveRecordingFidelity, setPreserveRecordingFidelity] = useState(true);

  const [platform, setPlatform] = useState<Platform>("web");
  const [llm, setLlm] = useState<LlmProvider>("ollama");
  const [model, setModel] = useState("llama3.2");
  const [locators, setLocators] = useState("");
  const [locatorUrl, setLocatorUrl] = useState("");
  const [pageLocale, setPageLocale] = useState<PlaywrightPageLocale>("auto");
  const [autoDetectLocators, setAutoDetectLocators] = useState(false);
  const [autoPreview, setAutoPreview] = useState<string | null>(null);
  const [fetchingLocators, setFetchingLocators] = useState(false);
  const [brandingOnlyPreview, setBrandingOnlyPreview] = useState(false);
  const [convertReport, setConvertReport] = useState<ConvertLocatorResultItem[] | null>(null);
  const [convertLoading, setConvertLoading] = useState(false);
  const [autoConvertBeforeGenerate, setAutoConvertBeforeGenerate] = useState(false);
  const [testCaseName, setTestCaseName] = useState("TC_Login_Smoke");
  const [katalonProjectPath, setKatalonProjectPath] = useState("");
  const [stylePass, setStylePass] = useState<StylePass>("none");
  const [useStream, setUseStream] = useState(false);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lint, setLint] = useState<LintIssue[] | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportResult, setExportResult] = useState<{ ok: boolean; message: string; path?: string } | null>(null);
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false
  );

  // Mobile (Appium) session state
  const [appiumUrl, setAppiumUrl] = useState("http://127.0.0.1:4723");
  const [appiumCapsText, setAppiumCapsText] = useState(
    JSON.stringify(
      {
        platformName: "Android",
        "appium:automationName": "UiAutomator2",
        "appium:deviceName": "Android Emulator",
      },
      null,
      2
    )
  );
  const [mobileSessionId, setMobileSessionId] = useState<string | null>(null);
  const [mobilePlatform, setMobilePlatform] = useState<string | null>(null);
  const [mobileStatus, setMobileStatus] = useState<string | null>(null);
  const [mobileLoading, setMobileLoading] = useState(false);
  const [mobileRecordProxyUrl, setMobileRecordProxyUrl] = useState<string | null>(null);
  const [mobileRecordedSteps, setMobileRecordedSteps] = useState<string[] | null>(null);
  const [mobileRecordedLocatorsText, setMobileRecordedLocatorsText] = useState<string | null>(null);

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
      .then((h) => {
        const gem =
          h.geminiConfigured === true
            ? "Gemini key: configured"
            : "Gemini key: not set (GEMINI_API_KEY on server)";
        setHealth(`${h.ollamaBase} · Ollama default ${h.defaultModel} · ${gem}`);
      })
      .catch(() => setHealth("API unreachable — start the backend"));
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (llm === "ollama") {
      setModel((m) => (OLLAMA_MODELS.some((x) => x.value === m) ? m : "llama3.2"));
    } else {
      setModel((m) => (GEMINI_MODELS.some((x) => x.value === m) ? m : "gemini-2.0-flash"));
    }
  }, [llm]);

  const effectiveSteps = useMemo(() => {
    if (tab === "manual") return splitSteps(manualSteps);
    if (tab === "csv") {
      if (csvFormat === "test-cases" && csvTestCaseRows.length) {
        return [...csvSelectedRowIndexes]
          .sort((a, b) => a - b)
          .flatMap((i) => csvTestCaseRows[i]?.stepLines ?? []);
      }
      return csvSteps;
    }
    if (tab === "jira") return splitSteps(jiraStepsText);
    if (tab === "record") return [];
    return [];
  }, [
    tab,
    manualSteps,
    csvSteps,
    csvFormat,
    csvTestCaseRows,
    csvSelectedRowIndexes,
    jiraStepsText,
  ]);

  const onCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setError(null);
    try {
      const data = await parseCsv(file);
      if (data.format === "test-cases") {
        setCsvFormat("test-cases");
        setCsvTestCaseRows(data.rows);
        setCsvSelectedRowIndexes(data.rows.map((_, i) => i));
        setCsvSteps(data.steps);
      } else {
        setCsvFormat("simple");
        setCsvTestCaseRows([]);
        setCsvSelectedRowIndexes([]);
        setCsvSteps(data.steps);
      }
    } catch (err) {
      setCsvSteps([]);
      setCsvFormat(null);
      setCsvTestCaseRows([]);
      setCsvSelectedRowIndexes([]);
      setError(err instanceof Error ? err.message : "CSV parse failed");
    }
  };

  const toggleCsvRowSelected = (index: number) => {
    setCsvSelectedRowIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index].sort((a, b) => a - b)
    );
  };

  const selectAllCsvRows = () => {
    setCsvSelectedRowIndexes(csvTestCaseRows.map((_, i) => i));
  };

  const clearAllCsvRows = () => {
    setCsvSelectedRowIndexes([]);
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
      const recLocatorLines = r.locators.map((l) => `${l.name} = ${l.selector}`).join("\n");
      setLocators((prev) => mergeLocatorBlock(prev, recLocatorLines));
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
      const lines = r.steps.join("\n");
      setJiraStepsText(lines);
      setJiraMeta({ mock: r.mock, summary: r.summary });
      setManualSteps(lines);
    } catch (err) {
      setJiraStepsText("");
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
        setError(
          "Paste a Playwright script above, record a flow, or enter a URL so the server can capture on Generate."
        );
        return;
      }
    }
    const recordHasScriptOrUrl =
      tab === "record" && platform === "web" && (recordPlaywrightScript.trim().length > 0 || recordUrl.trim().length > 0);
    if (effectiveSteps.length === 0 && !recordHasScriptOrUrl) {
      setError("Add at least one test step.");
      return;
    }
    if (tab !== "record" && autoDetectLocators && !locatorUrl.trim()) {
      setError("Enter a page URL or turn off auto-detect locators.");
      return;
    }
    setLoading(true);
    setOutput("");
    setLint(null);
    try {
      let locatorsForGenerate = locators;
      if (autoConvertBeforeGenerate) {
        const mergeLines = mergeLocatorLinesForConvert(locators, autoPreview);
        if (mergeLines.length > 0) {
          try {
            const convUrl = locatorUrl.trim() || recordUrl.trim() || undefined;
            const data = await convertLocatorsApi({ locators: mergeLines, url: convUrl });
            locatorsForGenerate = data.lines;
            setLocators(data.lines);
            setConvertReport(data.results);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Auto-convert before generate failed");
            setLoading(false);
            return;
          }
        }
      }

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
        locators: locatorsForGenerate,
        llm,
        model,
        testCaseName: testCaseName.trim() || undefined,
        autoDetectLocators:
          tab !== "record" && autoDetectLocators && Boolean(locatorUrl.trim()),
        url: urlForGenerate,
        pageLocale,
        stylePass,
        ...(tab === "record" && platform === "web"
          ? {
              mode: "record" as const,
              recordedPlaywrightScript: recordPlaywrightScript.trim() || undefined,
              preserveRecordingFidelity,
            }
          : {}),
      };
      if (useStream) {
        setLint(null);
        await generateCodeStream(payload, (chunk) => {
          setOutput((prev) => prev + chunk);
        });
      } else {
        const r = await generateCode(payload);
        setOutput(r.code);
        setLint(r.lint ?? []);
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

  const handleExportToKatalon = async () => {
    setExportResult(null);
    setError(null);
    if (!output.trim()) {
      setError("Generate a script first.");
      return;
    }
    if (!katalonProjectPath.trim()) {
      setError("Enter a local Katalon project path.");
      return;
    }
    if (!testCaseName.trim()) {
      setError("Enter a test case name.");
      return;
    }
    setExportLoading(true);
    try {
      const r = await exportToKatalonProject({
        projectPath: katalonProjectPath.trim(),
        testCaseName: testCaseName.trim(),
        script: output,
        createTcFile: true,
      });
      setExportResult({
        ok: true,
        message:
          "Test Case created successfully. In Katalon Studio: right-click the project → Refresh, or restart Studio if it still appears empty.",
        path: r.path,
      });
    } catch (err) {
      setExportResult({
        ok: false,
        message: err instanceof Error ? err.message : "Export failed",
      });
    } finally {
      setExportLoading(false);
    }
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

  const onMobileStart = async () => {
    setError(null);
    setMobileStatus(null);
    setMobileLoading(true);
    try {
      const caps = JSON.parse(appiumCapsText) as Record<string, unknown>;
      const r = await mobileStartSession({ appiumUrl: appiumUrl.trim(), capabilities: caps });
      setMobileSessionId(r.sessionId);
      setMobilePlatform(r.platformName);
      setMobileStatus(`Session started: ${r.platformName} (${r.sessionId})`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Appium session");
    } finally {
      setMobileLoading(false);
    }
  };

  const onMobileExtractLocators = async () => {
    setError(null);
    setMobileStatus(null);
    if (!mobileSessionId) {
      setError("Start an Appium session first.");
      return;
    }
    setMobileLoading(true);
    try {
      const r = await mobileExtractLocators({ appiumUrl: appiumUrl.trim(), sessionId: mobileSessionId });
      setMobilePlatform(r.platform);
      const lines = r.locators.map((l) => `${l.name} = ${l.selector}`).join("\n");
      setLocators((prev) => mergeLocatorBlock(prev, lines));
      setMobileStatus(`Extracted ${r.locators.length} locator lines (${r.platform}). Merged into Locators.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract locators");
    } finally {
      setMobileLoading(false);
    }
  };

  const onMobileStop = async () => {
    setError(null);
    setMobileStatus(null);
    if (!mobileSessionId) return;
    setMobileLoading(true);
    try {
      await mobileStopSession({ appiumUrl: appiumUrl.trim(), sessionId: mobileSessionId });
      setMobileStatus("Session stopped.");
      setMobileSessionId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop Appium session");
    } finally {
      setMobileLoading(false);
    }
  };

  const onMobileRecordStart = async () => {
    setError(null);
    setMobileStatus(null);
    setMobileLoading(true);
    try {
      const r = await mobileRecordStart({ appiumUrl: appiumUrl.trim() });
      setMobileRecordProxyUrl(r.proxyUrl);
      setMobileRecordedSteps(null);
      setMobileRecordedLocatorsText(null);
      setMobileStatus(`Recording started. Point Appium Inspector / driver to proxy URL: ${r.proxyUrl}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start recording");
    } finally {
      setMobileLoading(false);
    }
  };

  const onMobileRecordStop = async () => {
    setError(null);
    setMobileStatus(null);
    setMobileLoading(true);
    try {
      const r = await mobileRecordStop();
      setMobileRecordedSteps(r.steps);
      setMobileRecordedLocatorsText(r.locatorsText);
      setMobileStatus(`Recording stopped. Captured ${r.steps.length} steps and ${r.locatorsText ? "some" : "no"} locators.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not stop recording");
    } finally {
      setMobileLoading(false);
    }
  };

  const onMobileApplyRecording = () => {
    if (!mobileRecordedSteps || mobileRecordedSteps.length === 0) {
      setError("No recorded steps to apply.");
      return;
    }
    setTab("manual");
    setManualSteps(mobileRecordedSteps.join("\n"));
    if (mobileRecordedLocatorsText?.trim()) {
      setLocators((prev) => mergeLocatorBlock(prev, mobileRecordedLocatorsText));
    }
    setMobileStatus("Applied recorded steps to Manual steps and merged recorded locators into Locators.");
  };

  const onClearOutput = () => {
    setOutput("");
    setLint(null);
  };

  const clearCsvSelection = () => {
    setCsvFileName(null);
    setCsvSteps([]);
    setCsvFormat(null);
    setCsvTestCaseRows([]);
    setCsvSelectedRowIndexes([]);
    setError(null);
    if (csvInputRef.current) csvInputRef.current.value = "";
  };

  const handleConvertLocators = async () => {
    setError(null);
    const lines = mergeLocatorLinesForConvert(locators, autoPreview);
    if (lines.length === 0) {
      setConvertReport(null);
      setError("Add locator lines (Locators field and/or Playwright preview) before converting.");
      return;
    }
    setConvertLoading(true);
    try {
      const url = locatorUrl.trim() || recordUrl.trim() || undefined;
      const data = await convertLocatorsApi({ locators: lines, url });
      setLocators(data.lines);
      setConvertReport(data.results);
      if (data.errors.length > 0) {
        setError(
          `Conversion completed with ${data.errors.length} fallback(s). See the report below for details.`
        );
      } else {
        setError(null);
      }
    } catch (err) {
      setConvertReport(null);
      setError(err instanceof Error ? err.message : "Convert to Katalon locators failed");
    } finally {
      setConvertLoading(false);
    }
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
      const lines = await fetchPlaywrightLocatorsPreview(locatorUrl.trim(), pageLocale);
      setAutoPreview(lines.join("\n") || "(no elements found)");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Locator extraction failed");
    } finally {
      setFetchingLocators(false);
    }
  };

  const filteredAutoPreview = useMemo(() => {
    if (autoPreview === null) return null;
    if (!brandingOnlyPreview) return autoPreview;
    const lines = autoPreview.split(/\r?\n/);
    const keep = lines.filter((l) => /\b(logo|image|icon|svg|img|background)\b/i.test(l));
    return keep.join("\n") || "(no image/logo/icon locators found)";
  }, [autoPreview, brandingOnlyPreview]);

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
          <h1>Katalon script generator</h1>
          <p className="hint" style={{ margin: "0.25rem 0 0" }}>
            Choose <strong>Ollama</strong> (local) or <strong>Gemini</strong> (Google). The backend calls the model;
            Gemini uses <code>GEMINI_API_KEY</code> from server env only — never paste keys into the UI.
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
                <FieldClearBelow onClear={() => setManualSteps("")} disabled={!manualSteps.trim()} />
              </div>
            </div>
          )}

          {tab === "csv" && (
            <div className="stack">
              <div>
                <label className="field-label" htmlFor="csv">
                  CSV file
                </label>
                <input
                  id="csv"
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={onCsv}
                />
                <FieldClearBelow
                  onClear={clearCsvSelection}
                  disabled={!csvFileName && !csvSteps.length}
                />
              </div>
              <p className="hint">
                <strong>Simple format:</strong> columns <code>Step</code> + <code>Description</code> (or similar).
                <br />
                <strong>Test-case export:</strong> a <code>Steps</code> column (e.g. VIC / Zephyr) — only the Steps
                text is used; <code>| Expected: …</code> is removed. Pick which test-case rows to send to the
                generator.
              </p>
              {csvFileName && csvFormat === "simple" && (
                <p className="hint">
                  Loaded <strong>{csvFileName}</strong> — {csvSteps.length} step line(s).
                </p>
              )}
              {csvFileName && csvFormat === "test-cases" && csvTestCaseRows.length > 0 && (
                <div className="csv-test-case-panel">
                  <p className="hint" style={{ marginBottom: "0.5rem" }}>
                    <strong>{csvFileName}</strong> — {csvTestCaseRows.length} test case(s).{" "}
                    <strong>{csvSelectedRowIndexes.length}</strong> selected →{" "}
                    <strong>{effectiveSteps.length}</strong> step line(s) for generation.
                  </p>
                  <div className="csv-test-case-actions">
                    <button type="button" className="btn btn-ghost btn-small" onClick={selectAllCsvRows}>
                      Select all
                    </button>
                    <button type="button" className="btn btn-ghost btn-small" onClick={clearAllCsvRows}>
                      Clear all
                    </button>
                  </div>
                  <div className="csv-test-case-table-wrap">
                    <table className="csv-test-case-table">
                      <thead>
                        <tr>
                          <th className="csv-col-check" aria-label="Include" />
                          <th>ID</th>
                          <th>Description</th>
                          <th className="csv-col-n">Steps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvTestCaseRows.map((row, index) => (
                          <tr key={`${row.sourceRowIndex}-${row.testCaseId}`}>
                            <td>
                              <input
                                type="checkbox"
                                checked={csvSelectedRowIndexes.includes(index)}
                                onChange={() => toggleCsvRowSelected(index)}
                                aria-label={`Include ${row.testCaseId}`}
                              />
                            </td>
                            <td className="csv-tc-id">{row.testCaseId}</td>
                            <td className="csv-tc-title" title={row.title}>
                              {row.title.length > 90 ? `${row.title.slice(0, 90)}…` : row.title}
                            </td>
                            <td className="csv-tc-n">{row.stepLines.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
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
                <p className="hint" style={{ marginTop: "0.25rem" }}>
                  Use the <strong>site root</strong> (e.g. <code>https://jira.company.com</code>). Long browser URLs like
                  /secure/Dashboard.jspa are trimmed on the server.
                </p>
                <FieldClearBelow onClear={() => setJiraBaseUrl("")} disabled={!jiraBaseUrl.trim()} />
              </div>
              <div>
                <label className="field-label" htmlFor="jiraEmail">
                  Email (Cloud) or username (Server / Data Center)
                </label>
                <input
                  id="jiraEmail"
                  className="input"
                  type="text"
                  autoComplete="username"
                  placeholder="you@company.com or jira-username"
                  value={jiraEmail}
                  onChange={(e) => setJiraEmail(e.target.value)}
                />
                <FieldClearBelow onClear={() => setJiraEmail("")} disabled={!jiraEmail.trim()} />
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
                <FieldClearBelow onClear={() => setJiraApiToken("")} disabled={!jiraApiToken.trim()} />
              </div>
              <div className="row-2">
                <div>
                  <label className="field-label" htmlFor="jira">
                    Issue key or browse URL
                  </label>
                  <input
                    id="jira"
                    className="input"
                    value={jiraKey}
                    onChange={(e) => setJiraKey(e.target.value)}
                    placeholder="DE-123 or https://jira…/browse/DE-123"
                    spellCheck={false}
                  />
                  <FieldClearBelow onClear={() => setJiraKey("")} disabled={!jiraKey.trim()} />
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
                request and are not stored on the server. For <strong>gosi.ins</strong> and most on‑prem Jira: use your{" "}
                <strong>Jira username</strong> (login id), not always your email, with your password or a{" "}
                <strong>Personal Access Token</strong> from your Jira profile — not the Atlassian Cloud API token page.
              </p>
              {jiraMeta && (
                <p className="hint">
                  {jiraMeta.mock ? "Demo data (no credentials sent). " : "Loaded issue: "}
                  <strong>{jiraMeta.summary}</strong> — {splitSteps(jiraStepsText).length} step line(s) below.
                </p>
              )}
              <div className="jira-steps-panel">
                <label className="field-label" htmlFor="jiraStepsBox">
                  Test steps from Jira (one per line — used by Generate)
                </label>
                <p className="hint" style={{ marginBottom: "0.35rem" }}>
                  After <strong>Fetch from Jira</strong>, the issue description steps appear here. Edit if needed; the
                  generator uses exactly these lines while you stay on the Jira tab.
                </p>
                <textarea
                  id="jiraStepsBox"
                  className="input jira-steps-textarea"
                  rows={10}
                  value={jiraStepsText}
                  onChange={(e) => setJiraStepsText(e.target.value)}
                  placeholder='Click "Fetch from Jira" to load steps from the issue description…'
                  spellCheck={false}
                />
                <FieldClearBelow
                  onClear={() => setJiraStepsText("")}
                  disabled={!jiraStepsText.trim()}
                />
              </div>
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
                <FieldClearBelow onClear={() => setRecordUrl("")} disabled={!recordUrl.trim()} />
              </div>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={preserveRecordingFidelity}
                  onChange={(e) => setPreserveRecordingFidelity(e.target.checked)}
                />
                Lossless replay (preserve full trace; no inserted steps; skip Groovy optimizers)
              </label>
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
                <p className="hint" style={{ marginBottom: "0.35rem" }}>
                  Katalon is generated from this script on the server (an empty step list is sent). After{" "}
                  <strong>Record test flow</strong>, locator lines are merged into the main <strong>Locators</strong>{" "}
                  field below — edit there if needed.
                </p>
                <textarea
                  id="pwScript"
                  className="input record-flow-textarea"
                  rows={6}
                  value={recordPlaywrightScript}
                  onChange={(e) => setRecordPlaywrightScript(e.target.value)}
                  spellCheck={false}
                  placeholder="Paste a script or populate by recording…"
                  dir="ltr"
                />
                <FieldClearBelow
                  onClear={() => setRecordPlaywrightScript("")}
                  disabled={!recordPlaywrightScript.trim()}
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
                <label className="field-label" htmlFor="llm">
                  LLM provider
                </label>
                <select
                  id="llm"
                  className="input"
                  value={llm}
                  onChange={(e) => setLlm(e.target.value as LlmProvider)}
                >
                  <option value="ollama">Ollama (local)</option>
                  <option value="gemini">Google Gemini (API)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="model">
                {llm === "ollama" ? "Ollama model" : "Gemini model"}
              </label>
              <select
                id="model"
                className="input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {(llm === "ollama" ? OLLAMA_MODELS : GEMINI_MODELS).map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
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
              <FieldClearBelow onClear={() => setTestCaseName("")} disabled={!testCaseName.trim()} />
            </div>

            <div>
              <label className="field-label" htmlFor="katalonProjectPath">
                Katalon project path (for export)
              </label>
              <input
                id="katalonProjectPath"
                className="input"
                value={katalonProjectPath}
                onChange={(e) => setKatalonProjectPath(e.target.value)}
                placeholder="C:/Users/Admin/Katalon Studio/projectName"
              />
              <FieldClearBelow onClear={() => setKatalonProjectPath("")} disabled={!katalonProjectPath.trim()} />
              <p className="hint" style={{ marginTop: "0.4rem" }}>
                Must be a local Katalon project folder that contains <code>Test Cases</code>.
              </p>
            </div>

            {platform === "mobile" && (
              <div className="mobile-panel">
                <h3 style={{ margin: "0 0 0.25rem" }}>Mobile (Appium)</h3>
                <p className="hint" style={{ marginBottom: "0.5rem" }}>
                  Start an Appium session, then extract locators from the current screen and merge them into the{" "}
                  <strong>Locators</strong> box.
                </p>
                <div>
                  <label className="field-label" htmlFor="appiumUrl">
                    Appium server URL
                  </label>
                  <input
                    id="appiumUrl"
                    className="input"
                    value={appiumUrl}
                    onChange={(e) => setAppiumUrl(e.target.value)}
                    placeholder="http://127.0.0.1:4723"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="appiumCaps">
                    Capabilities (JSON)
                  </label>
                  <textarea
                    id="appiumCaps"
                    className="input"
                    value={appiumCapsText}
                    onChange={(e) => setAppiumCapsText(e.target.value)}
                    spellCheck={false}
                    rows={10}
                  />
                </div>
                <div className="row-actions" style={{ marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn-primary" onClick={onMobileStart} disabled={mobileLoading}>
                    {mobileLoading ? "Working…" : "Start session"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onMobileExtractLocators}
                    disabled={mobileLoading || !mobileSessionId}
                  >
                    Extract locators
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onMobileStop}
                    disabled={mobileLoading || !mobileSessionId}
                  >
                    Stop session
                  </button>
                  <span className="hint" style={{ margin: 0 }}>
                    {mobileSessionId ? `Session: ${mobileSessionId} ${mobilePlatform ? `(${mobilePlatform})` : ""}` : "No session"}
                  </span>
                </div>
                <div className="row-actions" style={{ marginTop: "0.6rem" }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onMobileRecordStart}
                    disabled={mobileLoading || Boolean(mobileRecordProxyUrl)}
                    title="Starts a local proxy that records WebDriver commands"
                  >
                    Start Recording
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onMobileRecordStop}
                    disabled={mobileLoading || !mobileRecordProxyUrl}
                  >
                    Stop Recording
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onMobileApplyRecording}
                    disabled={!mobileRecordedSteps || mobileRecordedSteps.length === 0}
                  >
                    Apply to Steps+Locators
                  </button>
                </div>
                {mobileRecordProxyUrl && (
                  <p className="hint" style={{ marginTop: "0.35rem" }}>
                    Proxy URL: <code>{mobileRecordProxyUrl}</code> (set this as your Appium server URL while recording)
                  </p>
                )}
                {mobileStatus && <p className="status-msg" style={{ marginTop: "0.35rem" }}>{mobileStatus}</p>}
              </div>
            )}

             <div>
               <label className="field-label" htmlFor="stylePass">
                 Format / style pass
               </label>
              <select
                id="stylePass"
                className="input"
                value={stylePass}
                onChange={(e) => setStylePass(e.target.value as StylePass)}
              >
                <option value="none">None</option>
                <option value="simplify">Simplify layout (post-process)</option>
                <option value="match-project">Match project style (prompt)</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="locators">
                Locators (label = Object Repository path or CSS, one per line)
              </label>
              {tab === "record" && (
                <p className="hint" style={{ marginBottom: "0.35rem" }}>
                  Each successful <strong>Record test flow</strong> merges <code>name = selector</code> lines here.
                </p>
              )}
              <textarea
                id="locators"
                className="input"
                value={locators}
                onChange={(e) => setLocators(e.target.value)}
                spellCheck={false}
              />
              <FieldClearBelow onClear={() => setLocators("")} disabled={!locators.trim()} />
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={autoConvertBeforeGenerate}
                onChange={(e) => setAutoConvertBeforeGenerate(e.target.checked)}
              />
              Auto convert before generate (Katalon CSS/XPath only)
            </label>

            <div className="loc-convert-toolbar">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConvertLocators}
                disabled={convertLoading || loading}
              >
                {convertLoading ? "Converting…" : "Convert to Katalon Locators"}
              </button>
              <span className="hint" style={{ margin: 0 }}>
                Merges <strong>Locators</strong> + <strong>Playwright preview</strong>; Playwright/Selenium/Cypress → CSS/XPath.
              </span>
            </div>

            {convertReport && convertReport.length > 0 && (
              <div className="loc-convert-report">
                <table>
                  <thead>
                    <tr>
                      <th>Label</th>
                      <th>Original</th>
                      <th>Converted</th>
                      <th>Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convertReport.map((row, i) => (
                      <tr key={`${row.label}-${i}`}>
                        <td>{row.label}</td>
                        <td className="loc-convert-code">{row.original}</td>
                        <td className="loc-convert-code">
                          {row.label} = {row.value}
                        </td>
                        <td
                          className={
                            row.confidence === "high"
                              ? "conf-high"
                              : row.confidence === "medium"
                                ? "conf-medium"
                                : "conf-low"
                          }
                        >
                          {row.confidence}
                          {row.error ? ` — ${row.error}` : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <label className="field-label" htmlFor="locatorUrl">
                Page URL (preview &amp; auto-detect for generate)
              </label>
              <input
                id="locatorUrl"
                className="input"
                type="url"
                value={locatorUrl}
                onChange={(e) => setLocatorUrl(e.target.value)}
                placeholder="https://..."
              />
              <FieldClearBelow onClear={() => setLocatorUrl("")} disabled={!locatorUrl.trim()} />
            </div>

            <div>
              <label className="field-label" htmlFor="pageLocale">
                Page language (Playwright extraction)
              </label>
              <select
                id="pageLocale"
                className="input"
                value={pageLocale}
                onChange={(e) => setPageLocale(e.target.value as PlaywrightPageLocale)}
              >
                <option value="auto">Auto</option>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
              </select>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={autoDetectLocators}
                onChange={(e) => setAutoDetectLocators(e.target.checked)}
              />
              Auto-detect for generate (CSS/XPath map; merge with manual; manual wins)
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
                <label className="field-label">
                  Playwright locators preview (getByRole / getByLabel / … — not saved until you generate)
                </label>
                <label className="checkbox-row" style={{ marginTop: "0.4rem" }}>
                  <input
                    type="checkbox"
                    checked={brandingOnlyPreview}
                    onChange={(e) => setBrandingOnlyPreview(e.target.checked)}
                  />
                  Show only images / logos / icons
                </label>
                <textarea
                  className="input locator-preview-textarea"
                  readOnly
                  value={filteredAutoPreview ?? ""}
                  rows={28}
                  spellCheck={false}
                  wrap="off"
                />
                <FieldClearBelow
                  onClear={() => {
                    setAutoPreview(null);
                    setBrandingOnlyPreview(false);
                  }}
                  disabled={!String(autoPreview ?? "").trim()}
                />
              </div>
            )}

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={useStream}
                onChange={(e) => setUseStream(e.target.checked)}
              />
              Stream response (live typing; {llm === "ollama" ? "Ollama" : "Gemini"} streaming API)
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
              {tab === "record" ? (
                <>
                  Record tab: generation uses the <strong>Playwright script</strong> and the main{" "}
                  <strong>Locators</strong> field (filled automatically when you record).
                </>
              ) : tab === "jira" ? (
                <>
                  Steps in use: <strong>{effectiveSteps.length}</strong> — taken from the <strong>Test steps from Jira</strong>{" "}
                  box on the Jira tab.
                </>
              ) : (
                <>Steps in use: {effectiveSteps.length}.</>
              )}
              {llm === "ollama" ? (
                <>
                  {" "}
                  Ensure Ollama is running (<code>ollama serve</code>) and the model is pulled (
                  <code>ollama pull {model}</code>).
                </>
              ) : (
                <>
                  {" "}
                  Set <code>GEMINI_API_KEY</code> in <code>server/.env</code> (or repo root <code>.env</code>), restart
                  the backend, and ensure the chosen model is enabled for your Google AI project.
                </>
              )}
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
            <button type="button" className="btn btn-ghost btn-small" onClick={onClearOutput} disabled={!output.trim()}>
              Clear
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={onCopy} disabled={!output}>
              Copy
            </button>
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={handleExportToKatalon}
              disabled={!output.trim() || exportLoading}
              title="Create a Test Case in your local Katalon project"
            >
              {exportLoading ? "Adding…" : "Add to Katalon Project"}
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
          {exportResult && (
            <div className={`status-banner ${exportResult.ok ? "ok" : "error"}`}>
              <strong>{exportResult.ok ? "✔" : "✖"} </strong>
              {exportResult.message}
              {exportResult.path ? (
                <>
                  {" "}
                  —{" "}
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => navigator.clipboard.writeText(exportResult.path!)}
                    title="Copy path"
                  >
                    {exportResult.path}
                  </button>
                </>
              ) : null}
            </div>
          )}
          <pre className="code-pre" aria-live="polite">
            {output || (loading ? "…" : "// Generated Groovy appears here")}
          </pre>
          {lint && lint.length > 0 && (
            <div className="lint-panel">
              <h3>Script checks</h3>
              {lint.map((issue, i) => (
                <div
                  key={`${issue.rule}-${issue.line ?? i}-${i}`}
                  className={`lint-item severity-${issue.severity}`}
                >
                  <strong>{issue.severity}</strong>
                  {issue.line != null ? ` · line ${issue.line}` : ""} · {issue.rule}: {issue.message}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
