const API_BASE = "";

export type Platform = "web" | "mobile";

export type LlmProvider = "ollama" | "gemini";

export type TestTemplate = "default" | "smoke" | "regression" | "api-mix" | "data-driven";

export type CommentLanguage = "en" | "ar";

export type StylePass = "none" | "simplify" | "match-project";

/** Playwright page language for locator extraction (preview + auto-detect). */
export type PlaywrightPageLocale = "auto" | "en" | "ar";

export interface LocatorResult {
  name: string;
  selector: string;
  type: "button" | "input" | "link" | "text" | "logo" | "image" | "icon" | "bgimage" | "unknown";
  text?: string;
  tag?: string;
  src?: string;
  alt?: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
  id?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export type GenerateMode = "manual" | "record";

export interface RecorderLocator {
  name: string;
  selector: string;
}

/** Lossless capture from the browser recorder (parallel to human-readable steps). */
export interface RecorderRawStep {
  action: "click" | "fill" | "navigate" | "change";
  selector?: string;
  url?: string;
  value?: string;
  timestamp?: number;
  tag?: string;
  text?: string;
  pageUrl?: string;
  reason?: string;
}

export interface RecordFlowResponse {
  steps: string[];
  locators: RecorderLocator[];
  playwrightScript: string;
  rawSteps?: RecorderRawStep[];
}

export interface GeneratePayload {
  platform: Platform;
  steps: string[];
  locators?: string;
  llm?: LlmProvider;
  model?: string;
  stream?: boolean;
  testCaseName?: string;
  mode?: GenerateMode;
  recordedPlaywrightScript?: string;
  autoDetectLocators?: boolean;
  url?: string;
  /** Infer from URL (auto), or force English / Arabic browser locale for extraction. */
  pageLocale?: PlaywrightPageLocale;
  /** Katalon-related XML (OR export, project fragment, etc.). Parsed on the server. */
  katalonProjectXml?: string;
  importedObjectRepositoryPaths?: string[];
  importedTestCasePaths?: string[];
  importedTestSuitePaths?: string[];
  testTemplate?: TestTemplate;
  executionProfile?: string;
  globalVariablesNote?: string;
  commentLanguage?: CommentLanguage;
  stylePass?: StylePass;
  includeStepOrSuggestions?: boolean;
  /**
   * When true (default), server uses deterministic compiler (no LLM). Set false for legacy LLM generation.
   */
  deterministicCompiler?: boolean;
  /** Include `healing` API hints in generate response (default true on server). */
  includeHealingMetadata?: boolean;
  /**
   * When true with Playwright recording: no parser dedupe, no intent-completion inserts,
   * strict step-count match; Groovy optimizers skipped on server.
   */
  preserveRecordingFidelity?: boolean;
}

export interface LintIssue {
  rule: string;
  severity: "error" | "warning" | "info";
  line?: number;
  message: string;
}

export interface GenerateResponse {
  code: string;
  model: string;
  platform: Platform;
  lint?: LintIssue[];
  /** Present when deterministic compiler emitted warnings (e.g. skipped steps). */
  compilerWarnings?: string[];
  /** True when Groovy came from the deterministic compiler. */
  deterministic?: boolean;
}

export interface ExportKatalonPayload {
  projectPath: string;
  testCaseName: string;
  script: string;
  /**
   * Must be true. Katalon requires a sibling metadata file:
   * `Test Cases/<TestCaseName>.tc` next to `Test Cases/<TestCaseName>/Script.groovy`.
   */
  createTcFile?: boolean;
}

export interface ExportKatalonResponse {
  success: boolean;
  /** Relative path inside the project, e.g. `Test Cases/TC_Login` */
  path: string;
  message?: string;
  /** Actual name used after auto-unique. */
  testCaseName: string;
  /** Absolute script path on disk. */
  scriptPath?: string;
  /** Absolute .tc path on disk (when created). */
  tcPath?: string;
}

export interface MobileSessionStartResponse {
  sessionId: string;
  platformName: "android" | "ios" | "unknown";
  capabilities: Record<string, unknown>;
}

export interface MobileLocatorItem {
  name: string;
  selector: string;
  kind: string;
  confidence: "high" | "medium" | "low";
}

export async function mobileStartSession(params: {
  appiumUrl: string;
  capabilities: Record<string, unknown>;
}): Promise<MobileSessionStartResponse> {
  const res = await fetch(`${API_BASE}/api/mobile/session/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<MobileSessionStartResponse> & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as MobileSessionStartResponse;
}

export async function mobileStopSession(params: {
  appiumUrl: string;
  sessionId: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/api/mobile/session/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
}

export async function mobileExtractLocators(params: {
  appiumUrl: string;
  sessionId: string;
}): Promise<{ platform: string; locators: MobileLocatorItem[] }> {
  const res = await fetch(`${API_BASE}/api/mobile/locators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as { platform?: string; locators?: MobileLocatorItem[]; error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return { platform: data.platform ?? "unknown", locators: data.locators ?? [] };
}

export interface MobileRecordStartResponse {
  proxyUrl: string;
  recordingId: string;
}

export interface MobileRecordStopResponse {
  steps: string[];
  locatorsText: string;
  rawCommands: unknown[];
}

export async function mobileRecordStart(params: { appiumUrl: string }): Promise<MobileRecordStartResponse> {
  const res = await fetch(`${API_BASE}/api/mobile/record/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<MobileRecordStartResponse> & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as MobileRecordStartResponse;
}

export async function mobileRecordStop(): Promise<MobileRecordStopResponse> {
  const res = await fetch(`${API_BASE}/api/mobile/record/stop`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as Partial<MobileRecordStopResponse> & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return {
    steps: data.steps ?? [],
    locatorsText: data.locatorsText ?? "",
    rawCommands: data.rawCommands ?? [],
  };
}

export interface KatalonUploadCounts {
  objectRepository: number;
  testCases: number;
  testSuites: number;
}

function normPathSeg(s: string): string {
  return s.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

/** Build multipart path for OR files (folder picker sends webkitRelativePath). */
function orMultipartPath(file: File, pathPrefix?: string): string {
  const withRel = file as File & { webkitRelativePath?: string };
  let rel = normPathSeg(withRel.webkitRelativePath || file.name);
  const p = pathPrefix?.trim().replace(/\/+$/, "") ?? "";
  if (p && rel !== p && !rel.startsWith(`${p}/`)) {
    rel = `${p}/${rel}`;
  }
  return rel;
}

export async function uploadKatalonArtifacts(params: {
  archive?: File | null;
  orFiles?: FileList | null;
  /**
   * If you used the folder picker on a single OR subfolder (e.g. only `aboutgosi`),
   * set this to that folder name so paths become `aboutgosi/Page_/…`.
   * If you picked the whole `Object Repository` folder, leave empty.
   */
  orFilesPathPrefix?: string;
  testCaseFiles?: FileList | null;
  testSuiteFiles?: FileList | null;
}): Promise<{
  objectRepositoryPaths: string[];
  testCasePaths: string[];
  testSuitePaths: string[];
  counts: KatalonUploadCounts;
  count: number;
}> {
  const fd = new FormData();
  if (params.archive) fd.append("archive", params.archive);
  if (params.orFiles?.length) {
    const prefix = params.orFilesPathPrefix;
    for (const f of Array.from(params.orFiles)) {
      fd.append("orFiles", f, orMultipartPath(f, prefix));
    }
  }
  if (params.testCaseFiles?.length) {
    for (const f of Array.from(params.testCaseFiles)) fd.append("testCaseFiles", f);
  }
  if (params.testSuiteFiles?.length) {
    for (const f of Array.from(params.testSuiteFiles)) fd.append("testSuiteFiles", f);
  }
  const res = await fetch(`${API_BASE}/api/katalon/upload`, { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    objectRepositoryPaths?: string[];
    testCasePaths?: string[];
    testSuitePaths?: string[];
    counts?: KatalonUploadCounts;
    count?: number;
  };
  if (!res.ok) throw new Error(data.error || res.statusText);
  const objectRepositoryPaths = data.objectRepositoryPaths ?? [];
  const testCasePaths = data.testCasePaths ?? [];
  const testSuitePaths = data.testSuitePaths ?? [];
  const counts = data.counts ?? {
    objectRepository: objectRepositoryPaths.length,
    testCases: testCasePaths.length,
    testSuites: testSuitePaths.length,
  };
  return {
    objectRepositoryPaths,
    testCasePaths,
    testSuitePaths,
    counts,
    count: data.count ?? objectRepositoryPaths.length,
  };
}

export async function matchOrToSteps(
  steps: string[],
  objectRepositoryPaths: string[]
): Promise<{
  matches: { step: string; suggestions: { path: string; score: number }[] }[];
}> {
  const res = await fetch(`${API_BASE}/api/katalon/match-or`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps, objectRepositoryPaths }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    matches?: { step: string; suggestions: { path: string; score: number }[] }[];
  };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return { matches: data.matches ?? [] };
}

/** Expand 422 JSON from /api/generate so the UI shows the real failure (compiler vs Groovy gate). */
function formatGenerateErrorBody(raw: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as {
      error?: string;
      validationErrors?: string[];
      validationStage?: string;
      stepNormalizationErrors?: string[];
      stepNormalizationWarnings?: string[];
    };
    if (Array.isArray(parsed.validationErrors) && parsed.validationErrors.length > 0) {
      const hint =
        parsed.validationStage === "compile"
          ? "\n(Add locator lines like `myButton = #id` for each step target, or generate from Record with locators merged.)"
          : "";
      return `${parsed.error ?? "Validation failed"}\n${parsed.validationErrors.map((e) => `- ${e}`).join("\n")}${hint}`;
    }
    if (Array.isArray(parsed.stepNormalizationErrors) && parsed.stepNormalizationErrors.length > 0) {
      const warn =
        Array.isArray(parsed.stepNormalizationWarnings) && parsed.stepNormalizationWarnings.length > 0
          ? `\nWarnings:\n- ${parsed.stepNormalizationWarnings.join("\n- ")}`
          : "";
      return `${parsed.error ?? "Steps could not be safely normalized into the Test DSL (no guessing)."}\nErrors:\n- ${parsed.stepNormalizationErrors.join("\n- ")}${warn}`;
    }
    return parsed.error;
  } catch {
    return undefined;
  }
}

export async function generateCode(
  payload: GeneratePayload
): Promise<GenerateResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, stream: false }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not complete request (${msg}). If the backend stopped mid-generation, restart it — older builds closed the connection after 200s while Ollama was still working.`
    );
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    const apiMsg = formatGenerateErrorBody(raw);
    throw new Error(apiMsg || raw.slice(0, 300) || res.statusText);
  }
  return res.json() as Promise<GenerateResponse>;
}

export async function generateCodeStream(
  payload: GeneratePayload,
  onChunk: (chunk: string) => void
): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, stream: true }),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Could not complete request (${msg}). If the backend stopped mid-stream, restart it after updating (server socket timeout fix).`
    );
  }
  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    const apiMsg = formatGenerateErrorBody(raw);
    throw new Error(apiMsg || raw.slice(0, 300) || res.statusText);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onChunk(chunk);
  }
  return full;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Clears a stuck server recording (closed browser tab, refreshed UI, etc.). */
export async function cancelRecordingOnServer(): Promise<void> {
  await fetch(`${API_BASE}/api/record/cancel`, { method: "POST" });
}

export async function exportToKatalonProject(
  payload: ExportKatalonPayload
): Promise<ExportKatalonResponse> {
  const res = await fetch(`${API_BASE}/api/export/katalon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as Partial<ExportKatalonResponse> & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as ExportKatalonResponse;
}

/**
 * Starts a headful recording on the server, polls live URL into `onUrlChange`, then returns the script/steps/locators when the session ends (Finish button or timeout).
 */
export async function recordTestFlow(
  url: string,
  onUrlChange?: (url: string) => void
): Promise<RecordFlowResponse> {
  const startOpts = {
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  };
  let start = await fetch(`${API_BASE}/api/record/start`, startOpts);
  if (start.status === 409) {
    await cancelRecordingOnServer();
    start = await fetch(`${API_BASE}/api/record/start`, startOpts);
  }
  if (!start.ok) {
    const err = await start.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || start.statusText);
  }
  for (;;) {
    await sleep(400);
    const stRes = await fetch(`${API_BASE}/api/record/status`);
    if (!stRes.ok) {
      const err = await stRes.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || stRes.statusText);
    }
    const st = (await stRes.json()) as { active: boolean; url: string | null };
    if (st.url) onUrlChange?.(st.url);
    if (!st.active) break;
  }
  const res = await fetch(`${API_BASE}/api/record/result`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<RecordFlowResponse>;
}

export async function extractLocatorsFromUrl(
  url: string,
  steps?: string[],
  pageLocale?: PlaywrightPageLocale
): Promise<LocatorResult[]> {
  const res = await fetch(`${API_BASE}/api/locators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      ...(steps && steps.length > 0 ? { steps } : {}),
      pageLocale: pageLocale ?? "auto",
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    locators?: LocatorResult[];
  };
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }
  return Array.isArray(data.locators) ? data.locators : [];
}

/** Playwright-style lines (getByRole, getByLabel, …) for the preview panel. */
export async function fetchPlaywrightLocatorsPreview(
  url: string,
  pageLocale: PlaywrightPageLocale = "auto"
): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/locators-playwright`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, pageLocale }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    lines?: string[];
  };
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }
  return Array.isArray(data.lines) ? data.lines : [];
}

export interface CsvTestCaseRow {
  sourceRowIndex: number;
  testCaseId: string;
  title: string;
  stepLines: string[];
}

export type ParseCsvResponse =
  | {
      format: "test-cases";
      rows: CsvTestCaseRow[];
      steps: string[];
      rowCount: number;
    }
  | {
      format: "simple";
      steps: string[];
      rowCount: number;
    };

export async function parseCsv(file: File): Promise<ParseCsvResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/parse-csv`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<ParseCsvResponse>;
}

export interface JiraCredentialsPayload {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraIssueResponse {
  key: string;
  summary: string;
  steps: string[];
  mock: boolean;
}

/**
 * Fetches Jira issue steps. Pass all three credential fields for a live API call;
 * omit or leave empty for offline demo data (response has mock: true).
 */
export async function fetchJiraIssue(
  issueKey: string,
  credentials?: JiraCredentialsPayload | null
): Promise<JiraIssueResponse> {
  const body: {
    issueKey: string;
    credentials?: JiraCredentialsPayload;
  } = { issueKey };
  const b = credentials?.baseUrl?.trim() ?? "";
  const e = credentials?.email?.trim() ?? "";
  const t = credentials?.apiToken?.trim() ?? "";
  if (b && e && t) {
    body.credentials = { baseUrl: b, email: e, apiToken: t };
  }

  const res = await fetch(`${API_BASE}/api/jira/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as JiraIssueResponse & { error?: string };
  if (!res.ok) {
    const msg = data.error || res.statusText;
    throw new Error(msg);
  }
  return data as JiraIssueResponse;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  platform: Platform;
  model: string;
  testCaseName?: string;
  stepsPreview: string;
  code: string;
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) throw new Error("Failed to load history");
  const data = await res.json();
  return (data as { entries: HistoryEntry[] }).entries;
}

export async function clearHistory(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear history");
}

export interface ConvertLocatorResultItem {
  label: string;
  type: "css" | "xpath";
  value: string;
  confidence: "high" | "medium" | "low";
  original: string;
  error?: string;
}

export interface ConvertLocatorsResponse {
  results: ConvertLocatorResultItem[];
  lines: string;
  errors: { label: string; message: string }[];
}

/** Converts Playwright / Selenium / Cypress locator lines to Katalon CSS/XPath only. */
export async function convertLocatorsApi(payload: {
  locators: string[];
  url?: string;
}): Promise<ConvertLocatorsResponse> {
  const res = await fetch(`${API_BASE}/api/convert-locators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as ConvertLocatorsResponse & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return {
    results: Array.isArray(data.results) ? data.results : [],
    lines: typeof data.lines === "string" ? data.lines : "",
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
}

export async function healthCheck(): Promise<{
  ok: boolean;
  ollamaBase: string;
  defaultModel: string;
  geminiConfigured?: boolean;
  defaultGeminiModel?: string;
}> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Server unreachable");
  return res.json();
}
