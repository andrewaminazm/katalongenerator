// In production (Netlify) this is set to the Render backend URL via VITE_API_URL.
// In local dev it stays empty so Vite's proxy forwards /api/* to localhost:8787.
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

/** Shown when /health reports Gosi Brain is not configured (matches server hint logic). */
export function defaultGosiConfigHint(): string {
  const base = API_BASE.toLowerCase();
  if (base.includes("onrender.com")) {
    return "Add GOSI_BRAIN_CHAT_URL and GOSI_BRAIN_API_KEY in Render → Environment, then redeploy.";
  }
  if (import.meta.env.PROD && !base) {
    return "Add GOSI_BRAIN_CHAT_URL and GOSI_BRAIN_API_KEY in Netlify → Environment variables, then redeploy.";
  }
  return "Add GOSI_BRAIN_CHAT_URL and GOSI_BRAIN_API_KEY to server/.env, then restart the backend.";
}

export type Platform = "web" | "mobile";

export type LlmProvider = "gosi-brain";

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

export type GenerateMode = "manual";

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
  /** Bearer token for Gosi Brain — WebView passes via URL → localStorage → optional override here. */
  authorization_token?: string;
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
  projectId?: string;
  projectGenerationMode?: "strict_reuse" | "balanced" | "generate_everything";
  /** Team style memory from indexed Katalon project (requires projectId). */
  aiMemoryMode?: AiMemoryMode;
}

export type AiMemoryMode = "disabled" | "learn_only" | "learn_suggest" | "adaptive";

export interface StyleMatchReport {
  styleMatchScore: number;
  reusedHelpers: string[];
  matchedPatterns: string[];
  matchedArchitecture: string[];
}

export type ProjectGenerationMode = "strict_reuse" | "balanced" | "generate_everything";

export type FrameworkKind = "ui" | "api" | "mobile" | "performance" | "hybrid";
export type ArchitecturePattern =
  | "page-object"
  | "hybrid"
  | "keyword-driven"
  | "data-driven"
  | "bdd"
  | "layered"
  | "microservice-api";
export type ProjectSize = "starter" | "standard" | "enterprise";
export type DomainHint = "ecommerce" | "banking" | "healthcare" | "saas" | "government" | "generic";

export interface ProjectGeneratorTemplate {
  id: string;
  name: string;
  description: string;
  frameworkKind: FrameworkKind;
  architecturePattern: ArchitecturePattern;
  defaultModules: string[];
}

export interface ProjectGeneratorAnalyzeResult {
  generationId: string;
  projectName: string;
  inferredModules: string[];
  inferredFlows: string[];
  architectureSummary: string;
  recommendedPattern: ArchitecturePattern;
  estimatedFileCount: number;
  warnings: string[];
}

export interface ProjectGeneratorGenerateResult {
  projectId: string;
  generationId: string;
  projectName: string;
  frameworkType: FrameworkKind;
  architecturePattern: ArchitecturePattern;
  generatedAt: string;
  fromCache: boolean;
  fileCount: number;
  structurePreview: string[];
  generatedModules: { id: string; name: string; layer: string; fileCount: number }[];
  pages: { name: string; path: string; actions: string[]; validations: string[] }[];
  keywords: { name: string; path: string; category: string }[];
  apis: { name: string; path: string; category: string }[];
  suites: { name: string; path: string; suiteType: string; testCasePaths: string[] }[];
  documentation: { path: string; title: string }[];
  healthScore: number;
  frameworkHealth: {
    overallScore: number;
    orQuality: number;
    assertionQuality: number;
    modularityScore: number;
    duplicationRisk: number;
    flakyRisk: number;
    maintainabilityScore: number;
    findings: string[];
  };
  dependencyGraph: {
    nodes: { id: string; label: string; layer: string }[];
    edges: { from: string; to: string; kind: string }[];
  };
  warnings: string[];
  downloadableZip: string;
}

export async function listProjectGeneratorTemplates(): Promise<ProjectGeneratorTemplate[]> {
  const res = await fetch(`${API_BASE}/api/project-generator/templates`);
  const data = (await res.json().catch(() => ({}))) as { templates?: ProjectGeneratorTemplate[]; error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data.templates ?? [];
}

export async function analyzeProjectGenerator(input: {
  projectName: string;
  description: string;
  frameworkKind: FrameworkKind;
  architecturePattern: ArchitecturePattern;
  domain: DomainHint;
  projectSize: ProjectSize;
  reuseMode: ProjectGenerationMode;
  sourceProjectId?: string;
  modules: string[];
  businessFlows: string[];
  includeReporting: boolean;
  includeBdd: boolean;
  includePerformance: boolean;
  includeMobile: boolean;
  swaggerText?: string;
  postmanText?: string;
  jiraEpic?: string;
  inputSources?: string[];
}): Promise<ProjectGeneratorAnalyzeResult> {
  const res = await fetch(`${API_BASE}/api/project-generator/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as ProjectGeneratorAnalyzeResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function generateProjectGenerator(input: Parameters<typeof analyzeProjectGenerator>[0] & { forceRefresh?: boolean }): Promise<ProjectGeneratorGenerateResult> {
  const res = await fetch(`${API_BASE}/api/project-generator/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = (await res.json().catch(() => ({}))) as ProjectGeneratorGenerateResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export interface ProjectMeta {
  projectId: string;
  projectName: string;
  uploadDate: string;
  sourceType: "zip" | "rar" | "folder";
  stats: {
    testObjects: number;
    keywords: number;
    keywordMethods: number;
    testScripts: number;
    testCases?: number;
    testSuites: number;
    profiles: number;
    groovyLibs: number;
    parseErrors: number;
  };
}

export interface ProjectIndexSummary extends ProjectMeta {
  testObjects: {
    label: string;
    path: string;
    selectorType: string;
    selector?: string;
    sourceFile?: string;
  }[];
  keywords: { className: string; customKeywordsPath: string; methods: { name: string; signature: string }[] }[];
  testScripts?: {
    logicalPath: string;
    scriptPath: string;
    displayName: string;
    kind: string;
  }[];
  testCases?: ProjectIndexSummary["testScripts"];
  reusableFlows: { id: string; name: string; description: string }[];
}

export async function listKatalonProjects(): Promise<ProjectMeta[]> {
  const res = await fetch(`${API_BASE}/api/projects`);
  const data = (await res.json().catch(() => ({}))) as { projects?: ProjectMeta[]; error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data.projects ?? [];
}

export async function uploadKatalonProjectZip(
  file: File,
  projectName?: string
): Promise<ProjectIndexSummary> {
  const fd = new FormData();
  fd.append("archive", file);
  if (projectName?.trim()) fd.append("projectName", projectName.trim());
  const res = await fetch(`${API_BASE}/api/projects/upload`, { method: "POST", body: fd });
  const data = (await res.json().catch(() => ({}))) as { project?: ProjectIndexSummary; error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  if (!data.project) throw new Error("No project returned");
  return data.project;
}

export async function fetchKatalonProject(projectId: string): Promise<ProjectIndexSummary> {
  const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}`);
  const data = (await res.json().catch(() => ({}))) as { project?: ProjectIndexSummary; error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  if (!data.project) throw new Error("Project not found");
  return data.project;
}

export interface ProjectIntelligenceV2Result {
  projectId: string;
  projectName: string;
  analyzedAt: string;
  fixes: {
    testCases: {
      scriptPath: string;
      logicalPath: string;
      original: string;
      fixed: string;
      diffSummary: string[];
      changed: boolean;
    }[];
    objectRepository: {
      orPath: string;
      label: string;
      oldLocator: { type: string; value: string };
      newLocator: { type: string; value: string };
      confidence: number;
      reason: string;
      severity: string;
      impactedScripts: string[];
    }[];
    keywords: { filePath: string; className: string; issue: string; suggestion: string }[];
  };
  documentation: { markdown: string; sections: Record<string, string> };
  projectGraph: {
    orphans: { testObjects: string[]; keywords: string[] };
    duplicates: { testObjects: { selector: string; paths: string[] }[] };
  };
  insights: {
    flakyTests: { logicalPath: string; riskScore: number; reasons: string[] }[];
    unusedAssets: { kind: string; label: string; reason: string }[];
    riskScore: number;
    refactoringHints: string[];
  };
  warnings: string[];
}

export interface ScriptFixItemResult {
  fix: {
    scriptPath: string;
    logicalPath: string;
    original: string;
    fixed: string;
    diffSummary: string[];
    changed: boolean;
    explanations?: { ruleId: string; severity: string; reason: string; confidence: number }[];
  };
  issues: { ruleId: string; severity: string; message: string; confidence: number }[];
}

export interface LocatorHealItemResult {
  orPath: string;
  label: string;
  oldLocator: { type: string; value: string };
  newLocator: { type: string; value: string };
  confidence: number;
  reason: string;
  impactedScripts: string[];
  candidates: { type: string; value: string; score: number; source: string }[];
  katalonSnippet: string;
  rsPreview: string;
  playwrightUsed: boolean;
  warnings: string[];
}

export async function fixProjectScript(
  projectId: string,
  scriptPath: string
): Promise<ScriptFixItemResult> {
  const res = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/v2/fix-script`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptPath }),
    }
  );
  const data = (await res.json().catch(() => ({}))) as ScriptFixItemResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function healProjectLocator(
  projectId: string,
  orPath: string,
  pageUrl?: string
): Promise<LocatorHealItemResult> {
  const res = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/v2/heal-locator`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orPath, pageUrl: pageUrl?.trim() || undefined }),
    }
  );
  const data = (await res.json().catch(() => ({}))) as LocatorHealItemResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function analyzeProjectIntelligenceV2(
  projectId: string,
  options?: {
    healScripts?: boolean;
    healLocators?: boolean;
    generateDocumentation?: boolean;
    maxScripts?: number;
  }
): Promise<ProjectIntelligenceV2Result> {
  const res = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}/v2/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(options ?? {}),
  });
  const data = (await res.json().catch(() => ({}))) as ProjectIntelligenceV2Result & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function downloadProjectDocumentationPdf(
  projectId: string,
  payload: { markdown: string; projectName?: string; title?: string }
): Promise<Blob> {
  const res = await fetch(
    `${API_BASE}/api/projects/${encodeURIComponent(projectId)}/v2/documentation/pdf`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || res.statusText);
  }
  return res.blob();
}

export interface LintIssue {
  rule: string;
  severity: "error" | "warning" | "info";
  line?: number;
  message: string;
}

export interface ProjectIntelligenceBinding {
  stepIndex: number;
  testObjectPath?: string;
  keywordCall?: string;
  confidence?: number;
}

export type GenerationMode =
  | "test_case"
  | "keyword_template"
  | "groovy_utility"
  | "hybrid"
  | "mixed_fallback";

export type CodeGenerationMode =
  | "auto"
  | "test_script"
  | "custom_keyword"
  | "groovy_function"
  | "utility_class"
  | "framework_helper"
  | "page_object"
  | "api_helper"
  | "db_utility"
  | "framework_service";

export interface KeywordTemplateMeta {
  className: string;
  methodName: string;
  platform: "web" | "mobile" | "api";
  confidence: number;
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
  /** When set to keyword_template, output is a Custom Keyword class — not a test script. */
  generationMode?: GenerationMode;
  keywordTemplate?: KeywordTemplateMeta;
  groovyUtility?: {
    className: string;
    methodName: string;
    platform: "web" | "mobile" | "api" | "utility";
    kind: string;
    confidence: number;
    subject: string;
    synthesizedBy: "template" | "generic" | "ai";
  };
  projectIntelligence?: {
    projectId: string;
    mode: ProjectGenerationMode;
    bindings: ProjectIntelligenceBinding[];
    warnings?: string[];
    suggestions?: string[];
  };
  aiMemory?: {
    mode: AiMemoryMode;
    styleMatch?: StyleMatchReport;
  };
  aiMemorySuggestions?: string[];
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

export async function mobilePingAppium(appiumUrl: string): Promise<
  | { ok: true; statusPath: string; ready?: boolean; version?: string }
  | { ok: false; error: string }
> {
  const q = new URLSearchParams({ url: appiumUrl.trim() });
  const res = await fetch(`${API_BASE}/api/mobile/appium/ping?${q}`);
  const data = (await res.json().catch(() => ({}))) as
    | { ok: true; statusPath: string; ready?: boolean; version?: string }
    | { ok: false; error?: string };
  if (!res.ok) {
    return { ok: false, error: (data as { error?: string }).error || res.statusText };
  }
  return data as { ok: true; statusPath: string; ready?: boolean; version?: string } | { ok: false; error: string };
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
          ? "\n(Add locator lines like `myButton = #id` for each step target, or use Page URL preview/auto-detect to fill locators.)"
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
    if (res.status === 401) {
      const msg = (() => { try { return (JSON.parse(raw) as { error?: string }).error; } catch { return undefined; } })();
      throw new Error(msg || "Unauthorized: Gosi Brain token missing or expired. Close and re-open this screen to refresh it.");
    }
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
    if (res.status === 401) {
      const msg = (() => { try { return (JSON.parse(raw) as { error?: string }).error; } catch { return undefined; } })();
      throw new Error(msg || "Unauthorized: Gosi Brain token missing or expired. Close and re-open this screen to refresh it.");
    }
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

// Record mode removed from the product UI (production servers are headless).

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
// Record mode removed from the product UI (production servers are headless).

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

/** Calls Jira GET /myself — if this works but fetch issue returns 403, you lack permission on that issue/project. */
export async function fetchJiraWhoami(credentials: JiraCredentialsPayload): Promise<{
  displayName: string;
  emailAddress?: string;
  accountId?: string;
}> {
  const res = await fetch(`${API_BASE}/api/jira/whoami`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credentials }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    displayName?: string;
    emailAddress?: string;
    accountId?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || res.statusText);
  }
  return {
    displayName: data.displayName ?? "(unknown)",
    emailAddress: data.emailAddress,
    accountId: data.accountId,
  };
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
  gosiBrainConfigured?: boolean;
  defaultGosiBrainModel?: string;
  gosiConfigHint?: string;
}> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Server unreachable");
  return res.json();
}

// —— AI Failure Analyzer ——

export type FailureType =
  | "LOCATOR"
  | "TIMING"
  | "API"
  | "ASSERTION"
  | "ENVIRONMENT"
  | "TEST_DATA"
  | "FRAMEWORK"
  | "BROWSER_AUTOMATION"
  | "UNKNOWN";

export interface FailureAnalysisPayload {
  logs?: string;
  stacktrace?: string;
  consoleLogs?: string;
  screenshot?: string;
  screenshotDescription?: string;
  apiResponse?: string;
  harLog?: string;
  katalonReport?: string;
  /** Katalon Mobile execution log (Appium-backed). */
  appiumLog?: string;
  projectId?: string;
  executionMetadata?: {
    testName?: string;
    failedStep?: string;
    retryCount?: number;
    url?: string;
    platform?: "web" | "mobile" | "api";
  };
  authorization_token?: string;
  model?: string;
}

export interface SuggestedFix {
  id: string;
  title: string;
  description: string;
  codeExample?: string;
  priority: "high" | "medium" | "low";
  category: string;
}

export interface DetectedPatternSummary {
  pattern: string;
  inference: string;
  failureType: FailureType;
  confidence: number;
}

export interface ExecutionLogInsights {
  failedTestObject?: string;
  failedKeyword?: string;
  failingStepMessage?: string;
  platform: string;
  timingSummary: string;
  retryAttempts: number;
  parseConfidence: number;
  warnings: string[];
}

export interface PlainEnglishReport {
  headline: string;
  whatHappened: string;
  likelyReason: string;
  stepsToTry: string[];
  errorSnippet?: string;
  testName?: string;
}

export interface FailureAnalysisResult {
  plainEnglish?: PlainEnglishReport;
  rootCause: string;
  rootCauseSummary: string;
  failureType: FailureType;
  flakyProbability: number;
  flakyLevel: "low" | "medium" | "high" | "unknown";
  confidence: number;
  rootCauseConfidence: number;
  suggestedFixConfidence: number;
  logOnlyMode: boolean;
  detectedPatterns: DetectedPatternSummary[];
  executionLogInsights?: ExecutionLogInsights;
  confidenceNotes?: string;
  affectedLayer: string;
  severity: string;
  reproducibility: string;
  secondaryFactors: string[];
  suggestedFixes: SuggestedFix[];
  recommendedArchitectureImprovements: string[];
  relatedPatterns: {
    id: string;
    signature: string;
    occurrences: number;
    lastSeen: string;
    flakyRate?: number;
  }[];
  healingSuggestions: { endpoint: string; description: string; payloadHint?: Record<string, unknown> }[];
  timeline: { id: string; label: string; kind: string; detail?: string }[];
  locatorInsights?: {
    problem: string;
    recommendation: string;
    isDynamic: boolean;
    domChangeLikely: boolean;
  };
  timingInsights?: {
    problem: string;
    recommendation: string;
    raceConditionLikely: boolean;
  };
  apiInsights?: {
    problem: string;
    recommendation: string;
    statusCode?: number;
    authIssue: boolean;
  };
  screenshotInsights?: string[];
  architectureInsights: string[];
  projectContext?: {
    matchedKeyword?: string;
    matchedOrPath?: string;
    sourceFileHint?: string;
  };
  aiEnhanced: boolean;
  uncertainty?: string;
  analyzedAt: string;
  reliability?: ReliabilityIntelligence;
}

export interface ReliabilityIntelligence {
  rootCauseConfidence: number;
  flakyProbability: number;
  repairSuccessPrediction: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reliabilityScore: number;
  confidenceExplanation: string[];
  failureCluster?: string;
  failureClusterId?: string;
  locatorHealth?: {
    orPath: string;
    label: string;
    healthScore: number;
    stabilityScore: number;
    failureCount: number;
    healCount: number;
    reasons: string[];
    recommendations: string[];
  };
  repairRecommendations: Array<{
    id: string;
    title: string;
    description: string;
    groovySnippet?: string;
    priority: string;
    repairSuccessPrediction: number;
    category: string;
  }>;
  preventiveSuggestions: string[];
  historicalFailures: Array<{
    id: string;
    analyzedAt: string;
    rootCauseSummary: string;
    failureType: FailureType;
    similarity: number;
  }>;
  regressionImpact?: {
    impactedTestCases: number;
    impactedKeywords: number;
    impactedOrObjects: number;
    impactedFlows: number;
    riskScore: number;
    topDependencies: string[];
  };
  environmentInsights: {
    environmentIssueLikely: boolean;
    signals: string[];
    falsePositiveRisk: number;
    recommendation: string;
  };
  businessFlowRisk?: {
    flowName: string;
    stabilityScore: number;
    riskLevel: string;
    flakyTrend: string;
    notes: string[];
  };
  stabilityTimeline: Array<{ date: string; event: string; impact: string }>;
  rootCauseGraph: {
    nodes: Array<{ id: string; label: string; kind: string }>;
    edges: Array<{ from: string; to: string; relation: string }>;
  };
  heatmapSlice: Array<{
    id: string;
    label: string;
    category: string;
    riskScore: number;
    failureCount: number;
  }>;
  frameworkWeaknesses: string[];
  riskAnalysis: string;
}

export async function analyzeFailure(
  payload: FailureAnalysisPayload
): Promise<FailureAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/failure/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as FailureAnalysisResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function fetchFailureHistory(): Promise<
  {
    id: string;
    analyzedAt: string;
    failureType: FailureType;
    rootCauseSummary: string;
    confidence: number;
    flakyProbability: number;
  }[]
> {
  const res = await fetch(`${API_BASE}/api/failure/history`);
  const data = (await res.json().catch(() => ({}))) as { history?: unknown[]; error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return (data.history ?? []) as ReturnType<typeof fetchFailureHistory> extends Promise<infer T>
    ? T
    : never;
}

export async function fetchFailurePatterns(): Promise<
  {
    signature: string;
    failureType: FailureType;
    count: number;
    avgFlakyProbability: number;
    hotspot: boolean;
  }[]
> {
  const res = await fetch(`${API_BASE}/api/failure/patterns`);
  const data = (await res.json().catch(() => ({}))) as { patterns?: unknown[]; error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return (data.patterns ?? []) as Awaited<ReturnType<typeof fetchFailurePatterns>>;
}

export interface ApiCodegenPreview {
  endpoints: { method: string; path: string; name: string; auth?: string }[];
  authType: string;
  validationStrategy: string;
  scenarioCount: number;
}

export interface GeneratedGroovyFile {
  path: string;
  kind: "keyword" | "script";
  content: string;
}

export interface ApiCodegenResult {
  groovyCode: string;
  files: GeneratedGroovyFile[];
  requestObjects: string[];
  schemaAssertions: string[];
  negativeTests: string[];
  boundaryTests: string[];
  reusableHelpers: string[];
  warnings: string[];
  preview: ApiCodegenPreview;
}

export interface ApiGeneratorPayload {
  projectId?: string;
  testCaseName?: string;
  includeNegative?: boolean;
  includeBoundary?: boolean;
  includeHelpers?: boolean;
  aiMemoryMode?: string;
}

async function postApiGenerator<T extends ApiGeneratorPayload>(
  path: string,
  body: T
): Promise<ApiCodegenResult> {
  const res = await fetch(`${API_BASE}/api/api-generator/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as ApiCodegenResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export function generateApiFromSwagger(
  payload: ApiGeneratorPayload & { spec: string }
): Promise<ApiCodegenResult> {
  return postApiGenerator("swagger", payload);
}

export function generateApiFromPostman(
  payload: ApiGeneratorPayload & { collection: string }
): Promise<ApiCodegenResult> {
  return postApiGenerator("postman", payload);
}

export function generateApiFromEndpoint(
  payload: ApiGeneratorPayload & {
    method?: string;
    path?: string;
    url?: string;
    requestJson?: string;
    responseJson?: string;
  }
): Promise<ApiCodegenResult> {
  return postApiGenerator("endpoint", payload);
}

export function generateApiFromCurl(
  payload: ApiGeneratorPayload & { curl: string }
): Promise<ApiCodegenResult> {
  return postApiGenerator("curl", payload);
}

export interface PostmanEnvironmentFile {
  id: string;
  name: string;
  values: { key: string; value: string; enabled: boolean }[];
}

export interface PostmanGenerateResult {
  collection: Record<string, unknown>;
  environments: PostmanEnvironmentFile[];
  warnings: string[];
  generatedTests: string[];
  collectionJson: string;
}

export interface PostmanGeneratePayload extends ApiGeneratorPayload {
  inputType?: "swagger" | "endpoint" | "curl" | "postman";
  swagger?: string;
  spec?: string;
  collection?: string;
  curl?: string;
  method?: string;
  path?: string;
  url?: string;
  requestJson?: string;
  responseJson?: string;
  baseUrl?: string;
  aiMemoryEnabled?: boolean;
  generatedApiFlow?: boolean;
}

export async function generatePostmanCollection(
  payload: PostmanGeneratePayload
): Promise<PostmanGenerateResult> {
  const res = await fetch(`${API_BASE}/api/postman/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as PostmanGenerateResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export type PerformanceMode = "smoke" | "baseline" | "stress" | "spike" | "soak";

export interface PerformanceScenario {
  id: string;
  name: string;
  module: string;
  endpoints: string[];
  vus: number;
  duration: string;
  rampUp: string;
  description: string;
}

export interface PerformanceStrategyReport {
  scenarios: PerformanceScenario[];
  loadModel: {
    mode: PerformanceMode;
    totalVus: number;
    duration: string;
    rampUp: string;
    stages: { duration: string; target: number }[];
    perCategory: Record<string, { vus: number; weight: number }>;
  };
  riskAnalysis: string[];
  slaRecommendations: string[];
  bottleneckHints: string[];
  dependencyRisks: string[];
}

export interface PerformanceGenerateResult {
  jmeter: string;
  k6: string;
  strategy: PerformanceStrategyReport;
  warnings: string[];
  baseUrl: string;
  endpointCount: number;
}

export interface PerformanceGeneratePayload {
  inputType?: "openapi" | "postman" | "curl" | "endpoint" | "project";
  swagger?: string;
  spec?: string;
  collection?: string;
  curl?: string;
  method?: string;
  path?: string;
  url?: string;
  requestJson?: string;
  responseJson?: string;
  testCaseName?: string;
  projectId?: string;
  useProjectApis?: boolean;
  mode?: PerformanceMode;
  config?: {
    vus?: number;
    duration?: string;
    rampUp?: string;
    environment?: "local" | "qa" | "staging" | "production";
    baseUrl?: string;
  };
  output?: ("jmeter" | "k6" | "strategy")[];
}

export async function generatePerformanceSuite(
  payload: PerformanceGeneratePayload
): Promise<PerformanceGenerateResult> {
  const res = await fetch(`${API_BASE}/api/performance/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as PerformanceGenerateResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

/* ——— AI QA Chat Workspace ——— */

export type WorkspaceIntent =
  | "generate"
  | "analyze"
  | "explain"
  | "optimize"
  | "document"
  | "review"
  | "heal"
  | "convert"
  | "performance"
  | "api"
  | "unknown";

export type WorkspaceAgent =
  | "script_generator"
  | "api_agent"
  | "performance_agent"
  | "project_intelligence"
  | "healing_agent"
  | "review_agent"
  | "documentation_agent"
  | "qa_advisor";

export interface WorkspaceContextPayload {
  activeTab?: string;
  platform?: Platform;
  projectId?: string;
  projectGenerationMode?: ProjectGenerationMode;
  aiMemoryMode?: "disabled" | "learn_only" | "learn_suggest" | "adaptive";
  testCaseName?: string;
  pageUrl?: string;
  swagger?: string;
  postmanCollection?: string;
  steps?: string[];
  locators?: string;
  workspaceMemoryEnabled?: boolean;
}

export interface WorkspaceMemoryCitation {
  id: string;
  layer: string;
  title: string;
  score: number;
}

export interface MemoryInsights {
  projectId: string;
  projectName: string;
  memoryChunkCount: number;
  layerCounts: Record<string, number>;
  topFlows: Array<{ name: string; description: string }>;
  repairSummary?: string;
  riskHints: string[];
  recommendations: Array<{
    id: string;
    title: string;
    detail: string;
    layer: string;
    confidence: number;
    basedOn: string[];
  }>;
  graphSummary: { nodes: number; edges: number };
}

export interface MemorySearchHit {
  chunk: { id: string; layer: string; title: string; content: string };
  score: number;
  whyRelevant: string;
}

export interface WorkspaceChatResponse {
  sessionId: string;
  intent: WorkspaceIntent;
  agent: WorkspaceAgent;
  response: string;
  actions: Array<{ type: string; label: string; detail?: string }>;
  generatedAssets: Array<{
    kind: string;
    title: string;
    content: string;
    language?: string;
  }>;
  suggestions: string[];
  confidence: number;
  code?: string;
  model?: string;
  warnings?: string[];
  memoryCitations?: WorkspaceMemoryCitation[];
}

const WORKSPACE_GOSI_TOKEN_KEY = "katalon:gosi_token";

export async function sendWorkspaceChat(payload: {
  sessionId?: string;
  message: string;
  context?: WorkspaceContextPayload;
  model?: string;
}): Promise<WorkspaceChatResponse> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem(WORKSPACE_GOSI_TOKEN_KEY)?.trim()
      : "";
  const res = await fetch(`${API_BASE}/api/ai-workspace/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      authorization_token: token || undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as WorkspaceChatResponse & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function updateWorkspaceContext(
  sessionId: string | undefined,
  context: WorkspaceContextPayload
): Promise<{ sessionId: string; context: WorkspaceContextPayload }> {
  const res = await fetch(`${API_BASE}/api/ai-workspace/context`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, context }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    sessionId: string;
    context: WorkspaceContextPayload;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function fetchWorkspaceHistory(sessionId: string): Promise<{
  sessionId: string;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: string }>;
  context: WorkspaceContextPayload;
}> {
  const res = await fetch(`${API_BASE}/api/ai-workspace/history/${encodeURIComponent(sessionId)}`);
  const data = (await res.json().catch(() => ({}))) as {
    sessionId: string;
    messages: Array<{ id: string; role: "user" | "assistant"; content: string; timestamp: string }>;
    context: WorkspaceContextPayload;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function indexWorkspaceMemory(projectId: string): Promise<{
  projectId: string;
  projectName: string;
  chunkCount: number;
  indexedAt: string;
}> {
  const res = await fetch(`${API_BASE}/api/workspace-memory/index`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    projectId?: string;
    projectName?: string;
    chunkCount?: number;
    indexedAt?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as { projectId: string; projectName: string; chunkCount: number; indexedAt: string };
}

export async function searchWorkspaceMemory(
  projectId: string,
  query: string,
  limit = 10
): Promise<{ projectId: string; query: string; hits: MemorySearchHit[] }> {
  const res = await fetch(`${API_BASE}/api/workspace-memory/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, query, limit }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    hits?: MemorySearchHit[];
    error?: string;
  };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as { projectId: string; query: string; hits: MemorySearchHit[] };
}

export async function fetchWorkspaceMemoryInsights(projectId: string): Promise<MemoryInsights> {
  const res = await fetch(
    `${API_BASE}/api/workspace-memory/insights/${encodeURIComponent(projectId)}`
  );
  const data = (await res.json().catch(() => ({}))) as MemoryInsights & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

/* ——— AI Coverage Analyzer ——— */

export interface CoverageAnalysisResult {
  projectId: string;
  projectName: string;
  analyzedAt: string;
  fromCache?: boolean;
  overallCoverage: number;
  riskScore: number;
  maintainabilityScore: number;
  flakyIndicatorCount: number;
  missingScenarioCount: number;
  modules: Array<{
    module: string;
    coverageScore: number;
    riskLevel: string;
    assertionScore: number;
    missingScenarios: string[];
    recommendations: string[];
    testScriptCount: number;
    orUsageScore: number;
  }>;
  missingScenarios: Array<{
    id: string;
    module: string;
    scenario: string;
    severity: string;
    source: string;
  }>;
  weakAssertions: Array<{
    scriptPath: string;
    logicalPath: string;
    actionCount: number;
    verifyCount: number;
    reason: string;
  }>;
  unusedAssets: Array<{ kind: string; path: string; reason: string }>;
  recommendations: Array<{
    id: string;
    severity: string;
    category: string;
    title: string;
    detail: string;
    affectedItems?: string[];
  }>;
  businessFlows: Array<{
    name: string;
    coveragePercent: number;
    relatedScripts: string[];
    gaps: string[];
    riskLevel: string;
  }>;
  duplicateFlows: Array<{ pattern: string; scripts: string[] }>;
  apiCoverage?: {
    totalEndpoints: number;
    referencedInOr: number;
    referencedInScripts: number;
    untestedEndpoints: string[];
    missingStatusValidations: string[];
    coveragePercent: number;
  };
  heatmap: Array<{
    module: string;
    coverage: number;
    risk: number;
    assertionQuality: number;
  }>;
  coverageGraph: {
    nodeCount: number;
    edgeCount: number;
    orphans: { testObjects: string[]; keywords: string[]; testScripts: string[] };
    duplicateFlowCount: number;
  };
}

export async function analyzeCoverage(payload: {
  projectId: string;
  swagger?: string;
  postmanCollection?: string;
  requirements?: string;
  forceRefresh?: boolean;
}): Promise<CoverageAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/coverage/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as CoverageAnalysisResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function fetchCoverageProject(projectId: string): Promise<CoverageAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/coverage/project/${encodeURIComponent(projectId)}`);
  const data = (await res.json().catch(() => ({}))) as CoverageAnalysisResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export type RefactorSeverity = "low" | "medium" | "high" | "critical" | "info";
export type FixComplexity = "low" | "medium" | "high";

export interface RefactorRecommendation {
  id: string;
  category: string;
  severity: RefactorSeverity;
  confidence: number;
  impactScore: number;
  fixComplexity: FixComplexity;
  title: string;
  detail: string;
  whyItMatters: string;
  affectedFiles: string[];
  suggestedSolution: string;
  beforeExample?: string;
  afterExample?: string;
  estimatedImpact: string;
  priority: number;
}

export interface RefactorAnalysisResult {
  projectId: string;
  projectName: string;
  analyzedAt: string;
  fromCache: boolean;
  maintainabilityScore: number;
  duplicationScore: number;
  frameworkHealthScore: number;
  assertionQualityScore: number;
  frameworkComplexityScore: number;
  orHealthScore: number;
  waitStabilityScore: number;
  issues: Array<Record<string, unknown>>;
  recommendations: RefactorRecommendation[];
  duplicateFlows: Array<{
    pattern: string;
    scripts: string[];
    suggestedKeyword?: string;
    estimatedSavings?: string;
  }>;
  weakAssertions: Array<{
    scriptPath: string;
    logicalPath: string;
    reason: string;
    suggestion: string;
  }>;
  orProblems: Array<{ path: string; problem: string; recommendation: string }>;
  keywordProblems: Array<{
    path: string;
    className: string;
    problem: string;
    recommendation: string;
  }>;
  architectureInsights: Array<{
    id: string;
    area: string;
    insight: string;
    recommendation: string;
    severity: RefactorSeverity;
  }>;
  duplicationHeatmap: Array<{ module: string; duplicationRisk: number; scriptCount: number }>;
}

export async function analyzeRefactor(payload: {
  projectId: string;
  forceRefresh?: boolean;
  maxScripts?: number;
}): Promise<RefactorAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/refactor/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as RefactorAnalysisResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function fetchRefactorProject(projectId: string): Promise<RefactorAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/refactor/project/${encodeURIComponent(projectId)}`);
  const data = (await res.json().catch(() => ({}))) as RefactorAnalysisResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export interface ProjectRepairSuggestion {
  id: string;
  category: string;
  severity: string;
  confidence: number;
  priority: number;
  title: string;
  detail: string;
  whyItMatters: string;
  affectedFiles: string[];
  suggestedFix: string;
  autoApplicable: boolean;
  beforeExample?: string;
  afterExample?: string;
}

export interface ProjectRepairDiff {
  filePath: string;
  category: string;
  suggestionId: string;
  original: string;
  repaired: string;
  diffSummary: string[];
  changed: boolean;
  lintPassed: boolean;
  lintWarnings: string[];
}

export interface ProjectRepairResult {
  repairId: string;
  projectId: string;
  projectName: string;
  analyzedAt: string;
  fromCache: boolean;
  healthScore: number;
  flakinessScore: number;
  frameworkHealth: {
    maintainabilityScore: number;
    locatorQualityScore: number;
    assertionQualityScore: number;
    architectureQualityScore: number;
    flakinessScore: number;
    duplicationScore: number;
    scalabilityScore: number;
    overallHealthScore: number;
  };
  repairSuggestions: ProjectRepairSuggestion[];
  locatorRepairs: Array<{
    orPath: string;
    label: string;
    problem: string;
    oldLocator: { type: string; value: string };
    newLocator?: { type: string; value: string };
    confidence: number;
  }>;
  duplicateFlows: Array<{ pattern: string; scripts: string[]; suggestedKeyword?: string }>;
  architectureWarnings: Array<{ area: string; warning: string; recommendation: string }>;
  riskAreas: Array<{ module: string; riskScore: number; reasons: string[]; repairPriority: number }>;
  dependencyIssues: Array<{ kind: string; from: string; to: string; message: string }>;
  repairDiffs: ProjectRepairDiff[];
  repairedFiles: ProjectRepairDiff[];
  rollbackAvailable: boolean;
  rollbackId?: string;
  downloadableZip?: string;
  warnings: string[];
  mode: string;
}

export async function analyzeProjectRepair(payload: {
  projectId: string;
  forceRefresh?: boolean;
  maxScripts?: number;
}): Promise<ProjectRepairResult> {
  const res = await fetch(`${API_BASE}/api/project-repair/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as ProjectRepairResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function previewProjectRepair(payload: {
  projectId: string;
  repairId: string;
  suggestionIds?: string[];
}): Promise<ProjectRepairResult> {
  const res = await fetch(`${API_BASE}/api/project-repair/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as ProjectRepairResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function executeProjectRepair(payload: {
  projectId: string;
  repairId: string;
  suggestionIds?: string[];
}): Promise<ProjectRepairResult> {
  const res = await fetch(`${API_BASE}/api/project-repair/repair`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as ProjectRepairResult & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
