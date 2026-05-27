import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearHistory,
  convertLocatorsApi,
  fetchPlaywrightLocatorsPreview,
  fetchHistory,
  fetchJiraIssue,
  fetchJiraWhoami,
  generateCode,
  generateCodeStream,
  defaultGosiConfigHint,
  healthCheck,
  parseCsv,
  type ConvertLocatorResultItem,
  type CsvTestCaseRow,
  cancelRecordingOnServer,
  recordTestFlow,
  exportToKatalonProject,
  mobilePingAppium,
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
  type CodeGenerationMode,
  type GenerationMode,
  type ProjectGenerationMode,
  type StylePass,
} from "./api";
import { ProjectIntelligencePanel } from "./ProjectIntelligencePanel";
import { ActionWithTip, CheckboxTip, FieldBlock, TabWithTip, TipIcon, ToolbarBtn } from "./FieldTip";
import { useGeneratorChrome } from "./components/layout/GeneratorChromeContext";
import { useLayoutContext } from "./components/layout/LayoutContext";
import { suiteForTab } from "./components/navigation/generatorSuites";
import { useGeneratorTabUrl } from "./hooks/useGeneratorTabUrl";
import { TIPS } from "./fieldTips";
import { useThemeOptional } from "./theme/useThemeOptional";
import {
  HelpMenu,
  OnboardingWizard,
  ScriptPanelBody,
  StepTemplatePicker,
  useOnboardingWizard,
} from "./Onboarding";
import type { StepTemplate } from "./onboardingContent";
import { FailureAnalyzerProvider } from "./components/AIFailureAnalyzer/FailureAnalyzerContext";
import { FailureAnalyzerInput } from "./components/AIFailureAnalyzer/FailureAnalyzerInput";
import { FailureAnalyzerResults } from "./components/AIFailureAnalyzer/FailureAnalyzerResults";
import { AIApiGeneratorProvider } from "./components/AIApiGenerator/AIApiGeneratorContext";
import { AIApiGeneratorTab } from "./components/AIApiGenerator/AIApiGeneratorTab";
import { GeneratedCodePanel } from "./components/AIApiGenerator/GeneratedCodePanel";
import { AIPerformanceProvider } from "./components/AIPerformance/AIPerformanceContext";
import { AIPerformanceTab } from "./components/AIPerformance/AIPerformanceTab";
import { PerformanceOutputPanel } from "./components/AIPerformance/PerformanceOutputPanel";
import "./App.css";

type InputTab = "manual" | "csv" | "jira" | "record" | "failure" | "api" | "performance";

/** Mobile WebView passes `?token=` once; we persist the Bearer value for /api/generate. */
const GOSI_TOKEN_KEY = "katalon:gosi_token";

/** Best-effort JWT exp check — no signature verification, browser-safe. */
function isTokenExpired(bearer: string): boolean {
  try {
    const raw = bearer.replace(/^Bearer\s+/i, "").trim();
    const parts = raw.split(".");
    if (parts.length !== 3) return false;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(b64)) as { exp?: unknown };
    if (typeof json.exp !== "number") return false;
    return json.exp * 1000 < Date.now();
  } catch {
    return false;
  }
}

const GOSI_BRAIN_MODELS = [
  { value: "qwen3-vl-30b-a3b-instruct-fp8", label: "qwen3-vl-30b-a3b-instruct-fp8 (default)" },
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

const INPUT_TABS = new Set<InputTab>([
  "manual",
  "csv",
  "jira",
  "record",
  "failure",
  "api",
  "performance",
]);

export default function App() {
  const layout = useLayoutContext();
  const { setChrome } = useGeneratorChrome();
  const theme = useThemeOptional();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useGeneratorTabUrl<InputTab>("manual", (t): t is InputTab =>
    INPUT_TABS.has(t as InputTab)
  );
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
  const [jiraVerifyMsg, setJiraVerifyMsg] = useState<string | null>(null);
  const [jiraLoading, setJiraLoading] = useState(false);

  const [recordUrl, setRecordUrl] = useState("");
  const [recordPlaywrightScript, setRecordPlaywrightScript] = useState("");
  const [recordLoading, setRecordLoading] = useState(false);
  /** When true, server keeps full trace (no dedupe / no intent inserts / strict count). Default on. */
  const [preserveRecordingFidelity, setPreserveRecordingFidelity] = useState(true);

  const [platform, setPlatform] = useState<Platform>("web");
  const llm: LlmProvider = "gosi-brain";
  const [model, setModel] = useState("qwen3-vl-30b-a3b-instruct-fp8");
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
  const [testCaseName, setTestCaseName] = useState("");
  const [katalonProjectPath, setKatalonProjectPath] = useState("");
  const [activeProjectId, setActiveProjectId] = useState("");
  const [projectGenerationMode, setProjectGenerationMode] =
    useState<ProjectGenerationMode>("balanced");
  const [stylePass, setStylePass] = useState<StylePass>("none");
  const [useStream, setUseStream] = useState(false);

  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gosiBrainReady, setGosiBrainReady] = useState<boolean | null>(null);
  const [gosiConfigHint, setGosiConfigHint] = useState<string | null>(null);
  const [gosiToken, setGosiToken] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem(GOSI_TOKEN_KEY) ?? "" : ""
  );
  const [gosiTokenNotice, setGosiTokenNotice] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lint, setLint] = useState<LintIssue[] | null>(null);
  const [generationMode, setGenerationMode] = useState<GenerationMode | null>(null);
  const [codeGenerationMode, setCodeGenerationMode] = useState<CodeGenerationMode>("auto");
  const [aiMemoryMode, setAiMemoryMode] = useState<
    "disabled" | "learn_only" | "learn_suggest" | "adaptive"
  >("learn_suggest");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportResult, setExportResult] = useState<{ ok: boolean; message: string; path?: string } | null>(null);
  const dark = theme?.dark ?? false;

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
  /** Base URL used when the session was created — never the recording proxy (fixes Extract locators / Stop). */
  const [mobileSessionAppiumUrl, setMobileSessionAppiumUrl] = useState<string | null>(null);
  const [mobilePlatform, setMobilePlatform] = useState<string | null>(null);
  const [mobileStatus, setMobileStatus] = useState<string | null>(null);
  const [mobileLoading, setMobileLoading] = useState(false);
  const [mobileRecordProxyUrl, setMobileRecordProxyUrl] = useState<string | null>(null);
  const [mobileRecordedSteps, setMobileRecordedSteps] = useState<string[] | null>(null);
  const [mobileRecordedLocatorsText, setMobileRecordedLocatorsText] = useState<string | null>(null);

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
        setGosiBrainReady(h.gosiBrainConfigured === true);
        setGosiConfigHint(h.gosiConfigHint ?? defaultGosiConfigHint());
      })
      .catch(() => {
        setGosiBrainReady(null);
        setGosiConfigHint(null);
      });
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");
    if (urlToken?.trim()) {
      const raw = urlToken.trim();
      const bearer = raw.startsWith("Bearer ") ? raw : `Bearer ${raw}`;
      localStorage.setItem(GOSI_TOKEN_KEY, bearer);
      setGosiToken(bearer);
      params.delete("token");
      const newSearch = params.toString();
      const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : "");
      window.history.replaceState({}, "", newUrl);
      setGosiTokenNotice("Gosi Brain token configured");
    }
  }, []);

  useEffect(() => {
    if (!gosiTokenNotice) return;
    const t = window.setTimeout(() => setGosiTokenNotice(null), 5000);
    return () => window.clearTimeout(t);
  }, [gosiTokenNotice]);


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

  const onJiraTestLogin = async () => {
    setError(null);
    setJiraVerifyMsg(null);
    const b = jiraBaseUrl.trim();
    const e = jiraEmail.trim();
    const t = jiraApiToken.trim();
    if (!b || !e || !t) {
      setError("Fill Jira URL, email, and API token to test login.");
      return;
    }
    setJiraLoading(true);
    try {
      const r = await fetchJiraWhoami({ baseUrl: b, email: e, apiToken: t });
      setJiraVerifyMsg(
        `Login OK — Jira recognizes you as "${r.displayName}"${r.emailAddress ? ` (${r.emailAddress})` : ""}. If Fetch from Jira still returns 403, your account likely cannot browse that issue’s project (permission), not a bad token.`
      );
    } catch (err) {
      setJiraVerifyMsg(null);
      setError(err instanceof Error ? err.message : "Login test failed");
    } finally {
      setJiraLoading(false);
    }
  };

  const onFetchJira = async () => {
    setError(null);
    setJiraVerifyMsg(null);
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
    const t = gosiToken.trim() || localStorage.getItem(GOSI_TOKEN_KEY)?.trim() || "";
    // Only block if a token IS present in localStorage but it is expired.
    // When no localStorage token exists, the server uses GOSI_BRAIN_AUTHORIZATION_TOKEN env.
    if (t && isTokenExpired(t)) {
      setError("Your Gosi Brain token has expired. Please re-open the app to refresh it.");
      return;
    }
    setLoading(true);
    setOutput("");
    setLint(null);
    setGenerationMode(null);
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

      const tokenForGosi = gosiToken.trim() || localStorage.getItem(GOSI_TOKEN_KEY)?.trim() || "";

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
        ...(tokenForGosi ? { authorization_token: tokenForGosi } : {}),
        ...(tab === "record" && platform === "web"
          ? {
              mode: "record" as const,
              recordedPlaywrightScript: recordPlaywrightScript.trim() || undefined,
              preserveRecordingFidelity,
            }
          : {}),
        ...(activeProjectId
          ? { projectId: activeProjectId, projectGenerationMode, aiMemoryMode }
          : {}),
        codeGenerationMode,
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
        setGenerationMode(r.generationMode ?? "test_case");
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

  const onMobilePingAppium = async () => {
    setError(null);
    setMobileStatus(null);
    setMobileLoading(true);
    try {
      const r = await mobilePingAppium(appiumUrl.trim());
      if (r.ok) {
        const extra = [r.version ? r.version : null].filter(Boolean).join("");
        setMobileStatus(
          `Appium is reachable (${r.statusPath}${extra ? `, ${extra}` : ""}). You can start a session.`
        );
      } else {
        setError(r.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ping failed");
    } finally {
      setMobileLoading(false);
    }
  };

  const onMobileStart = async () => {
    setError(null);
    setMobileStatus(null);
    setMobileLoading(true);
    try {
      const caps = JSON.parse(appiumCapsText) as Record<string, unknown>;
      const base = appiumUrl.trim();
      const r = await mobileStartSession({ appiumUrl: base, capabilities: caps });
      setMobileSessionId(r.sessionId);
      setMobileSessionAppiumUrl(base);
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
      const baseForSession = mobileSessionAppiumUrl ?? appiumUrl.trim();
      const r = await mobileExtractLocators({ appiumUrl: baseForSession, sessionId: mobileSessionId });
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
      const baseForSession = mobileSessionAppiumUrl ?? appiumUrl.trim();
      await mobileStopSession({ appiumUrl: baseForSession, sessionId: mobileSessionId });
      setMobileStatus("Session stopped.");
      setMobileSessionId(null);
      setMobileSessionAppiumUrl(null);
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

  const { wizardOpen, openWizard, closeWizard } = useOnboardingWizard();

  const onApplyStepTemplate = (template: StepTemplate) => {
    setTab("manual");
    setManualSteps(template.steps);
    if (template.pageUrl) setLocatorUrl(template.pageUrl);
    setError(null);
  };

  const activeSuite = suiteForTab(tab);
  const showInputTabs = activeSuite === "input";

  useEffect(() => {
    if (!layout.embedded) return;
    setChrome({
      gosiBrainReady,
      gosiConfigHint,
      activeProjectLabel: activeProjectId ? `Project: ${activeProjectId}` : undefined,
      onOpenWizard: openWizard,
    });
  }, [
    layout.embedded,
    setChrome,
    gosiBrainReady,
    gosiConfigHint,
    activeProjectId,
    openWizard,
  ]);

  return (
    <div className={layout.embedded ? "app-shell app-shell--embedded" : "app-shell"}>
      {!layout.embedded && (
        <header className="app-header">
          <div>
            <h1>Katalon script generator</h1>
          </div>
          <div className="header-meta">
            {gosiBrainReady !== null && (
              <span
                className="badge"
                style={{
                  background:
                    gosiBrainReady === true
                      ? "var(--ok-bg, #e8f5e9)"
                      : gosiBrainReady === null
                        ? "var(--error-bg, #ffebee)"
                        : "var(--warn-bg, #fff8e1)",
                  color:
                    gosiBrainReady === true
                      ? "var(--ok, #2e7d32)"
                      : gosiBrainReady === null
                        ? "var(--error, #c62828)"
                        : "var(--warn, #e65100)",
                }}
                title={gosiConfigHint ?? undefined}
              >
                {gosiBrainReady === true
                  ? "Gosi Brain: ready"
                  : gosiBrainReady === null
                    ? "API unreachable"
                    : gosiConfigHint ?? "Gosi Brain: not configured on API server"}
              </span>
            )}
            <HelpMenu onOpenWizard={openWizard} />
            <button
              type="button"
              className="theme-toggle"
              onClick={() => theme?.toggleTheme()}
              aria-label="Toggle dark mode"
            >
              {dark ? "Light" : "Dark"}
            </button>
          </div>
        </header>
      )}

      <OnboardingWizard open={wizardOpen} onClose={closeWizard} />

      <FailureAnalyzerProvider
        activeProjectId={activeProjectId}
        authorizationToken={gosiToken.trim() || localStorage.getItem(GOSI_TOKEN_KEY)?.trim() || undefined}
        model={model}
      >
      <AIApiGeneratorProvider activeProjectId={activeProjectId} aiMemoryMode={aiMemoryMode}>
      <AIPerformanceProvider activeProjectId={activeProjectId}>
      <div className="app-body">
        <section className="panel">
          {showInputTabs && (
            <div className="tabs" role="tablist" aria-label="Test input sources">
              <TabWithTip tip={TIPS.tabManual} active={tab === "manual"} onClick={() => setTab("manual")}>
                Manual
              </TabWithTip>
              <TabWithTip tip={TIPS.tabCsv} active={tab === "csv"} onClick={() => setTab("csv")}>
                CSV
              </TabWithTip>
              <TabWithTip tip={TIPS.tabJira} active={tab === "jira"} onClick={() => setTab("jira")}>
                Jira
              </TabWithTip>
              <TabWithTip
                tip={platform === "mobile" ? "Recording is available for Web only." : TIPS.tabRecord}
                active={tab === "record"}
                disabled={platform === "mobile"}
                onClick={() => setTab("record")}
              >
                Record
              </TabWithTip>
            </div>
          )}

          {tab === "manual" ? (
            <div className="stack">
              <StepTemplatePicker onApply={onApplyStepTemplate} />
              <FieldBlock tip={TIPS.steps} label="Test steps (one per line)" htmlFor="steps">
                <textarea
                  id="steps"
                  className="input"
                  value={manualSteps}
                  onChange={(e) => setManualSteps(e.target.value)}
                  spellCheck={false}
                />
                <FieldClearBelow onClear={() => setManualSteps("")} disabled={!manualSteps.trim()} />
              </FieldBlock>
            </div>
          ) : tab === "csv" ? (
            <div className="stack">
              <FieldBlock tip={TIPS.csv} label="CSV file" htmlFor="csv">
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
              </FieldBlock>
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
          ) : tab === "jira" ? (
            <div className="stack">
              <FieldBlock tip={TIPS.jiraBase} label="Jira base URL" htmlFor="jiraBase">
                <input
                  id="jiraBase"
                  className="input"
                  type="url"
                  autoComplete="url"
                  placeholder="https://your-domain.atlassian.net"
                  value={jiraBaseUrl}
                  onChange={(e) => setJiraBaseUrl(e.target.value)}
                />
                <FieldClearBelow onClear={() => setJiraBaseUrl("")} disabled={!jiraBaseUrl.trim()} />
              </FieldBlock>
              <FieldBlock
                tip={TIPS.jiraEmail}
                label="Email (Cloud) or username (Server / Data Center)"
                htmlFor="jiraEmail"
              >
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
              </FieldBlock>
              <FieldBlock tip={TIPS.jiraToken} label="Password, PAT, or API token" htmlFor="jiraToken">
                <input
                  id="jiraToken"
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  placeholder="On-prem: your Jira password or Personal Access Token. Cloud: Atlassian API token"
                  value={jiraApiToken}
                  onChange={(e) => setJiraApiToken(e.target.value)}
                />
                <FieldClearBelow onClear={() => setJiraApiToken("")} disabled={!jiraApiToken.trim()} />
              </FieldBlock>
              <div className="row-2">
                <FieldBlock tip={TIPS.jiraKey} label="Issue key or browse URL" htmlFor="jira">
                  <input
                    id="jira"
                    className="input"
                    value={jiraKey}
                    onChange={(e) => setJiraKey(e.target.value)}
                    placeholder="DE-123 or https://jira…/browse/DE-123"
                    spellCheck={false}
                  />
                  <FieldClearBelow onClear={() => setJiraKey("")} disabled={!jiraKey.trim()} />
                </FieldBlock>
                <div style={{ alignSelf: "flex-end", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onJiraTestLogin}
                    disabled={jiraLoading}
                    title="Calls Jira GET /myself — verifies URL + login without loading an issue"
                  >
                    Test Jira login
                  </button>
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
              {jiraVerifyMsg && (
                <p className="hint status-msg" style={{ marginTop: "0.35rem" }}>
                  {jiraVerifyMsg}
                </p>
              )}
              <p className="hint">
                Leave all three fields empty to load <strong>demo</strong> steps only. Nothing is stored on the server.{" "}
                <strong>403 on Test Jira login</strong> on Data Center often means the server blocks Basic auth to REST
                (use a <strong>PAT</strong> in the third field) or your account is not allowed to use the REST API — ask
                the Jira admin. <strong>401</strong> means wrong username, password, or site URL.
              </p>
              {jiraMeta && (
                <p className="hint">
                  {jiraMeta.mock ? "Demo data (no credentials sent). " : "Loaded issue: "}
                  <strong>{jiraMeta.summary}</strong> — {splitSteps(jiraStepsText).length} step line(s) below.
                </p>
              )}
              <FieldBlock
                tip={TIPS.jiraSteps}
                label="Test steps from Jira (one per line — used by Generate)"
                htmlFor="jiraStepsBox"
                className="jira-steps-panel"
              >
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
              </FieldBlock>
            </div>
          ) : tab === "record" ? (
            <div className="stack">
              <p className="hint">
                Opens a real Chromium window on the <strong>machine running the backend</strong>. Use{" "}
                <strong>Finish recording</strong> in the page when done (or wait for the session timeout).
              </p>
              <FieldBlock tip={TIPS.recordUrl} label="URL to open" htmlFor="recordUrl">
                <input
                  id="recordUrl"
                  className="input"
                  type="url"
                  value={recordUrl}
                  onChange={(e) => setRecordUrl(e.target.value)}
                  placeholder="https://..."
                />
                <FieldClearBelow onClear={() => setRecordUrl("")} disabled={!recordUrl.trim()} />
              </FieldBlock>
              <CheckboxTip
                id="preserveFidelity"
                tip={TIPS.preserveFidelity}
                checked={preserveRecordingFidelity}
                onChange={setPreserveRecordingFidelity}
                label="Lossless replay (preserve full trace; no inserted steps; skip Groovy optimizers)"
              />
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
              <FieldBlock
                tip={TIPS.recordScript}
                label="Playwright-style script (editable)"
                htmlFor="pwScript"
              >
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
              </FieldBlock>
            </div>
          ) : tab === "failure" ? (
            <FailureAnalyzerInput />
          ) : tab === "api" ? (
            <AIApiGeneratorTab />
          ) : tab === "performance" ? (
            <AIPerformanceTab />
          ) : null}

          {tab !== "failure" && tab !== "api" && tab !== "performance" && (
          <>
          <div className="stack" style={{ marginTop: "1rem" }}>
            <div className="row-2">
              <FieldBlock tip={TIPS.platform} label="Platform" htmlFor="platform">
                <select
                  id="platform"
                  className="input"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as Platform)}
                >
                  <option value="web">Web (WebUI)</option>
                  <option value="mobile">Mobile (Mobile)</option>
                </select>
              </FieldBlock>
              <FieldBlock tip={TIPS.codeOutput} label="Code output" htmlFor="code-gen-mode">
                <select
                  id="code-gen-mode"
                  className="input"
                  value={codeGenerationMode}
                  onChange={(e) => setCodeGenerationMode(e.target.value as CodeGenerationMode)}
                >
                  <option value="auto">Auto detect</option>
                  <option value="test_script">Test script</option>
                  <option value="custom_keyword">Custom keyword</option>
                  <option value="groovy_function">Groovy function</option>
                  <option value="utility_class">Utility class</option>
                  <option value="framework_helper">Framework helper</option>
                  <option value="page_object">Page object</option>
                  <option value="api_helper">API helper</option>
                  <option value="db_utility">DB utility</option>
                  <option value="framework_service">Framework service</option>
                </select>
              </FieldBlock>
            </div>

            {gosiTokenNotice && (
              <p className="hint" style={{ marginTop: "0.35rem", color: "var(--ok, #2e7d32)" }}>
                {gosiTokenNotice}
              </p>
            )}

            {(() => {
              const t = gosiToken.trim() || localStorage.getItem(GOSI_TOKEN_KEY)?.trim() || "";
              if (!t) return null; // server will use GOSI_BRAIN_AUTHORIZATION_TOKEN env fallback
              if (isTokenExpired(t))
                return (
                  <p className="hint" style={{ color: "var(--error, #c62828)" }}>
                    Token expired — please re-open the app to get a fresh token.
                  </p>
                );
              return (
                <p className="hint" style={{ color: "var(--ok, #2e7d32)" }}>
                  Gosi Brain token: active
                </p>
              );
            })()}

            <FieldBlock tip={TIPS.model} label="Gosi Brain model" htmlFor="model">
              <select
                id="model"
                className="input"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {GOSI_BRAIN_MODELS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </FieldBlock>

            <FieldBlock tip={TIPS.testCaseName} label="Test case name (optional)" htmlFor="name">
              <input
                id="name"
                className="input"
                value={testCaseName}
                onChange={(e) => setTestCaseName(e.target.value)}
              />
              <FieldClearBelow onClear={() => setTestCaseName("")} disabled={!testCaseName.trim()} />
            </FieldBlock>

            <ProjectIntelligencePanel
              activeProjectId={activeProjectId}
              generationMode={projectGenerationMode}
              onActiveProjectId={setActiveProjectId}
              onGenerationMode={setProjectGenerationMode}
            />

            {activeProjectId && (
              <FieldBlock tip={TIPS.aiMemory} label="Gosi Brain memory (team style)" htmlFor="ai-memory-mode">
                <select
                  id="ai-memory-mode"
                  className="input"
                  value={aiMemoryMode}
                  onChange={(e) =>
                    setAiMemoryMode(
                      e.target.value as "disabled" | "learn_only" | "learn_suggest" | "adaptive"
                    )
                  }
                >
                  <option value="disabled">Disabled</option>
                  <option value="learn_only">Learn only (index on upload)</option>
                  <option value="learn_suggest">Learn + suggest (default)</option>
                  <option value="adaptive">Fully adaptive generation</option>
                </select>
              </FieldBlock>
            )}

            <FieldBlock
              tip={TIPS.katalonExportPath}
              label="Katalon project path (for export)"
              htmlFor="katalonProjectPath"
            >
              <input
                id="katalonProjectPath"
                className="input"
                value={katalonProjectPath}
                onChange={(e) => setKatalonProjectPath(e.target.value)}
                placeholder="C:/Users/Admin/Katalon Studio/projectName"
              />
              <FieldClearBelow onClear={() => setKatalonProjectPath("")} disabled={!katalonProjectPath.trim()} />
            </FieldBlock>

            {platform === "mobile" && (
              <div className="mobile-panel">
                <h3 style={{ margin: "0 0 0.25rem" }}>Mobile (Appium)</h3>
                <p className="hint" style={{ marginBottom: "0.5rem" }}>
                  <strong>Appium must be running</strong> locally (default <code>http://127.0.0.1:4723</code>) before
                  you use Start session or recording. Use <strong>Extract locators</strong> to pull elements from the
                  current emulator screen into the <strong>Locators</strong> box below (or use{" "}
                  <strong>Appium Inspector</strong> separately for a visual tree).
                </p>
                <FieldBlock
                  tip={TIPS.appiumUrl}
                  label="Appium server URL (usually port 4723)"
                  htmlFor="appiumUrl"
                >
                  <input
                    id="appiumUrl"
                    className="input"
                    value={appiumUrl}
                    onChange={(e) => setAppiumUrl(e.target.value)}
                    placeholder="http://127.0.0.1:4723"
                  />
                </FieldBlock>
                <FieldBlock tip={TIPS.appiumCaps} label="Capabilities (JSON)" htmlFor="appiumCaps">
                  <textarea
                    id="appiumCaps"
                    className="input"
                    value={appiumCapsText}
                    onChange={(e) => setAppiumCapsText(e.target.value)}
                    spellCheck={false}
                    rows={10}
                  />
                </FieldBlock>
                <div className="row-actions" style={{ marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost" onClick={onMobilePingAppium} disabled={mobileLoading}>
                    Check Appium
                  </button>
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
                    Recording proxy (use <strong>only</strong> in Appium Inspector / another client):{" "}
                    <code>{mobileRecordProxyUrl}</code>. Do <strong>not</strong> replace the Appium server URL field
                    above — Extract locators and Stop session must keep using <code>http://127.0.0.1:4723</code>.
                  </p>
                )}
                {mobileStatus && <p className="status-msg" style={{ marginTop: "0.35rem" }}>{mobileStatus}</p>}
              </div>
            )}

            <FieldBlock tip={TIPS.stylePass} label="Format / style pass" htmlFor="stylePass">
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
            </FieldBlock>

            <FieldBlock
              tip={TIPS.locators}
              label="Locators (label = Object Repository path or CSS, one per line)"
              htmlFor="locators"
            >
              <textarea
                id="locators"
                className="input"
                value={locators}
                onChange={(e) => setLocators(e.target.value)}
                spellCheck={false}
              />
              <FieldClearBelow
                onClear={() => {
                  setLocators("");
                  // Also hide the conversion report list so "Clear" truly clears the UI.
                  setConvertReport(null);
                  setError(null);
                }}
                disabled={!locators.trim()}
              />
            </FieldBlock>

            <CheckboxTip
              id="autoConvert"
              tip={TIPS.autoConvert}
              checked={autoConvertBeforeGenerate}
              onChange={setAutoConvertBeforeGenerate}
              label="Auto convert before generate (Katalon CSS/XPath only)"
            />

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

            <FieldBlock
              tip={TIPS.locatorUrl}
              label="Page URL (preview & auto-detect for generate)"
              htmlFor="locatorUrl"
            >
              <input
                id="locatorUrl"
                className="input"
                type="url"
                value={locatorUrl}
                onChange={(e) => setLocatorUrl(e.target.value)}
                placeholder="https://..."
              />
              <FieldClearBelow onClear={() => setLocatorUrl("")} disabled={!locatorUrl.trim()} />
            </FieldBlock>

            <FieldBlock tip={TIPS.pageLocale} label="Page language (Playwright extraction)" htmlFor="pageLocale">
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
            </FieldBlock>

            <CheckboxTip
              id="autoDetect"
              tip={TIPS.autoDetect}
              checked={autoDetectLocators}
              onChange={setAutoDetectLocators}
              label="Auto-detect for generate (CSS/XPath map; merge with manual; manual wins)"
            />

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
              <FieldBlock
                tip={TIPS.locatorPreview}
                label="Playwright locators preview (not saved until you generate)"
              >
                <CheckboxTip
                  id="brandingPreview"
                  tip={TIPS.brandingPreview}
                  checked={brandingOnlyPreview}
                  onChange={setBrandingOnlyPreview}
                  label="Show only images / logos / icons"
                />
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
              </FieldBlock>
            )}

            <CheckboxTip
              id="useStream"
              tip={TIPS.stream}
              checked={useStream}
              onChange={setUseStream}
              label="Stream response (live typing)"
            />

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

            <ActionWithTip tip={TIPS.generate} onClick={onGenerate} disabled={loading}>
              {loading ? "Generating…" : "Generate Katalon Groovy"}
            </ActionWithTip>
          </div>

          <div className="history">
            <div className="field-label-row" style={{ marginBottom: "0.5rem" }}>
              <h2 style={{ margin: 0 }}>Recent generations (server)</h2>
              <TipIcon tip={TIPS.history} />
            </div>
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
          </>
          )}
        </section>

        <section className="panel code-panel">
          {tab === "failure" ? (
            <FailureAnalyzerResults />
          ) : tab === "api" ? (
            <GeneratedCodePanel />
          ) : tab === "performance" ? (
            <PerformanceOutputPanel />
          ) : (
          <>
          <div className="code-panel-header">
            <span className="field-label">
              {generationMode === "keyword_template"
                ? "Generated keyword class"
                : generationMode === "groovy_utility"
                  ? "Generated Groovy utility"
                  : generationMode === "hybrid"
                    ? "Generated utility + test script"
                    : "Generated script"}
            </span>
            {generationMode === "keyword_template" && (
              <span className="badge badge-keyword-mode" title="Output is a reusable Custom Keyword class, not a test case">
                Mode: Custom Keyword Generator
              </span>
            )}
            {generationMode === "groovy_utility" && (
              <span className="badge badge-keyword-mode" title="Reusable Groovy utility or helper class">
                Mode: Groovy Utility Generator
              </span>
            )}
            {generationMode === "hybrid" && (
              <span className="badge badge-keyword-mode" title="Utility class plus test script">
                Mode: Hybrid (Utility + Test)
              </span>
            )}
            <TipIcon tip={TIPS.output} />
          </div>
          <div className="code-toolbar">
            <ToolbarBtn
              tip="Clear the editor."
              className="btn btn-ghost btn-small"
              onClick={onClearOutput}
              disabled={!output.trim()}
            >
              Clear
            </ToolbarBtn>
            <ToolbarBtn
              tip="Copy Groovy to clipboard."
              className="btn btn-ghost btn-small"
              onClick={onCopy}
              disabled={!output}
            >
              Copy
            </ToolbarBtn>
            <ToolbarBtn
              tip={TIPS.exportKatalon}
              className="btn btn-primary btn-small"
              onClick={handleExportToKatalon}
              disabled={!output.trim() || exportLoading}
            >
              {exportLoading ? "Adding…" : "Add to Katalon Project"}
            </ToolbarBtn>
            <ToolbarBtn
              tip={TIPS.download}
              className="btn btn-ghost btn-small"
              onClick={onDownload}
              disabled={!output}
            >
              Download .groovy
            </ToolbarBtn>
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
          <ScriptPanelBody
            loading={loading}
            stepCount={effectiveSteps.length}
            hasOutput={Boolean(output.trim())}
          >
            <pre className="code-pre" aria-live="polite">
              {output}
            </pre>
          </ScriptPanelBody>
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
          </>
          )}
        </section>
      </div>
      </AIPerformanceProvider>
      </AIApiGeneratorProvider>
      </FailureAnalyzerProvider>
    </div>
  );
}
