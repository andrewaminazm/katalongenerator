export type Platform = "web" | "mobile";

export type GenerateMode = "manual" | "record";

export type LlmProvider = "ollama" | "gemini";

export type TestTemplate = "default" | "smoke" | "regression" | "api-mix" | "data-driven";

export type CommentLanguage = "en" | "ar";

export type StylePass = "none" | "simplify" | "match-project";

/** Browser locale for Playwright URL extraction (preview + auto-detect). Matches server `playwrightLocale.ts`. */
export type PlaywrightPageLocale = "auto" | "en" | "ar";

/** Optional snapshot of an existing Katalon project — drives keyword/OR-first generation. */
export interface KatalonProjectContext {
  projectName?: string;
  keywords?: string[];
  objectRepository?: string[];
  testCases?: string[];
  /** Test suite collection paths (e.g. `Regression/Smoke`) from `Test Suites/*.ts`. */
  testSuites?: string[];
  frameworkType?: string;
  /** Raw / truncated XML passed through for the model (from katalonProjectXml). */
  sourceXml?: string;
  /** Warnings for the model (e.g. .prj vs real Object Repository XML). */
  importHints?: string[];
}

export interface GenerateRequestBody {
  platform: Platform;
  steps: string[];
  locators?: string;
  /** Default `ollama` when omitted. Gemini uses `GEMINI_API_KEY` on the server only. */
  llm?: LlmProvider;
  model?: string;
  stream?: boolean;
  testCaseName?: string;
  /** When `record`, may run headful Playwright or use `recordedPlaywrightScript` from a prior record session. */
  mode?: GenerateMode;
  /** Playwright-style script from the Record tab; when set with `mode: record`, server skips a new recording if `url` is omitted. */
  recordedPlaywrightScript?: string;
  /** When true with `url`, run Playwright to append auto-detected locators (user still wins on label conflict). */
  autoDetectLocators?: boolean;
  /** Page URL for auto locators or for `mode: record` live session. */
  url?: string;
  /** Playwright locale for extraction: auto (infer from URL), en, or ar. Default auto. */
  pageLocale?: PlaywrightPageLocale;
  /** Katalon-related XML (Object Repository export, project fragment, etc.) — parsed server-side. */
  katalonProjectXml?: string;
  /** OR paths from POST /api/katalon/upload (merged with XML-derived paths). */
  importedObjectRepositoryPaths?: string[];
  /** Test case folder paths from partial import (`Test Cases/...`). */
  importedTestCasePaths?: string[];
  /** Test suite names/paths from partial import (`Test Suites/*.ts`). */
  importedTestSuitePaths?: string[];
  /** Adjusts tone and expected script shape in the prompt. */
  testTemplate?: TestTemplate;
  /** Execution profile name (informational for the model). */
  executionProfile?: string;
  /** Free text: which GlobalVariable.* fields to prefer. */
  globalVariablesNote?: string;
  /** Language for // Step / // Purpose comments. */
  commentLanguage?: CommentLanguage;
  /** Post-process or prompt for layout / project style. */
  stylePass?: StylePass;
  /** When false, skip injecting heuristic step→OR suggestions into the prompt. Default true when OR paths exist. */
  includeStepOrSuggestions?: boolean;
  /**
   * When true (default), Groovy is emitted by the deterministic Katalon compiler (no LLM).
   * Set `false` to use the legacy LLM + prompt path.
   */
  deterministicCompiler?: boolean;
  /**
   * When true (default), JSON responses include a `healing` block with self-healing API pointers.
   */
  includeHealingMetadata?: boolean;
  /**
   * When true: Playwright parse keeps duplicate navigations/fills, skips intent-completion inserts,
   * enforces exact step count after normalization, and skips Groovy optimizers.
   * When omitted with `mode: "record"`, the server defaults to true (lossless replay).
   */
  preserveRecordingFidelity?: boolean;
}

/** Lint output returned with non-streaming /api/generate. */
export interface LintIssue {
  rule: string;
  severity: "error" | "warning" | "info";
  line?: number;
  message: string;
}

export interface JiraCredentialsBody {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraFetchBody {
  issueKey: string;
  /** When all three fields are set, Jira REST API is called. Omit or leave empty for offline demo data. */
  credentials?: JiraCredentialsBody;
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
