/** Hover tips for form fields — explains the end-to-end flow. */
export const TIPS = {
  tabManual:
    "Write test steps in plain English. Best with an active Katalon project: use keyword Class.method and click OR names from your repo.",
  tabCsv:
    "Upload a CSV of steps or test-case exports. Select rows, then generate Groovy like the Manual tab.",
  tabJira:
    "Pull steps from a Jira issue (or demo data). Edit the steps box, then generate on the right.",
  tabRecord:
    "Record a web flow in a browser on the server machine. Playwright script and locators fill automatically.",
  tabFailure:
    "Paste Katalon execution logs only — infers root cause, flakiness, and fixes without stacktrace or screenshot.",
  tabApiGenerator:
    "API Test — semantic folders, chained variables, schema-aware tests, and enterprise Katalon/Postman output (export only).",
  tabPerformance:
    "Performance Test — generate JMeter (.jmx) and k6 load scripts from the same API definitions with smoke, baseline, stress, spike, and soak models.",

  headerDocumentation:
    "Open the in-app Documentation center — guides for Manual, API Test, Performance, Project Intelligence, imports, and troubleshooting. Includes search and step-by-step workflows.",
  headerAiWorkspace:
    "Open Gosi Brain QA Workspace — chat naturally to generate Groovy, API suites, load strategies, run Project Analyze, or get locator and architecture advice. Uses your active project and optional Swagger/Postman context.",
  headerCoverage:
    "Open Gosi Brain Coverage Analyzer — SonarQube-style coverage intelligence: gaps, weak assertions, OR/keyword health, API coverage, business flows, and risk heatmaps for indexed Katalon projects.",
  headerRefactor:
    "Open Gosi Brain Refactoring Assistant — maintainability scores, duplicate flows, OR/keyword cleanup, wait/assertion quality, and prioritized refactoring recommendations (read-only).",

  projectAnalyze:
    "Project Analyze — full analysis of the active project: script fixes (original vs fixed), OR locator healing suggestions, dependency graph, risk score, and downloadable PDF documentation.",
  projectExplorerOr:
    "Browse indexed Object Repository items. Click a row to heal and rank locators; add a Page URL in the panel to enable Playwright DOM analysis.",
  projectExplorerKeywords:
    "Browse indexed Custom Keywords. Use these exact names when writing steps (e.g. use keyword common.WebUiHelpers.openToUrl).",
  projectExplorerScripts:
    "Browse indexed Groovy test scripts (Scripts/, Test Cases/, Include/). Click a row to regenerate/fix its internal code (waits, OR remaps, stability fixes).",
  projectExplorerFlows:
    "Reusable flows detected from repeated step patterns. Use them to refactor duplicated test scripts into shared keywords.",

  steps:
    "One action per line. Examples: use keyword common.WebUiHelpers.openToUrl | click p_The General | visit https://example.com. With an active project, OR names and keywords are matched automatically.",
  csv:
    "Upload .csv with a Step/Description column, or a test-case export with a Steps column. Select which rows to include before Generate.",
  jiraBase:
    "Your Jira site root only, e.g. https://company.atlassian.net — not a long /browse/ URL.",
  jiraEmail:
    "Atlassian Cloud: your account email. Jira Server/Data Center: your Jira username.",
  jiraToken:
    "Cloud: API token from Atlassian account settings. On-prem: password or Personal Access Token. Use Test Jira login to verify.",
  jiraKey:
    "Issue key (PROJ-123) or full browse URL. Fetch loads description/steps into the editable box below.",
  jiraSteps:
    "These lines are sent to Generate. Edit after fetch if needed.",
  recordUrl:
    "Page to open in the headed browser on the server. Must be reachable from where the backend runs.",
  recordScript:
    "Playwright code from recording. Generate uses this instead of re-recording when URL is empty.",
  preserveFidelity:
    "Keeps every recorded action in order with no deduplication — closest to what you recorded.",

  platform:
    "Web uses WebUI keywords. Mobile uses Appium/Mobile keywords and the Appium panel below.",
  model:
    "Gosi Brain model for optional LLM paths. Deterministic generate does not require the model to be up.",
  testCaseName:
    "Optional name for comments and when exporting a .groovy file or adding to a Katalon project folder.",
  projectUpload:
    "Upload a Katalon Studio .zip or .rar. Indexes Object Repository, Keywords, and Scripts/ for reuse.",
  activeProject:
    "Select an indexed project so Generate reuses findTestObject paths and CustomKeywords calls.",
  generationMode:
    "Strict: only high-confidence reuse. Balanced: default. Generate everything: prefer new inline code.",
  katalonExportPath:
    "Local folder path to your Katalon project (must contain Test Cases). Used by Add to Katalon Project.",

  appiumUrl:
    "Real Appium server URL (usually port 4723). Do not put the recording proxy URL here.",
  appiumCaps:
    "JSON capabilities for your device/emulator — platformName, deviceName, app package, etc.",

  stylePass:
    "Optional post-processing of generated Groovy layout or style hints from your project.",
  locators:
    "One per line: Label = selector or Label = Page/OR/path. Merged with auto-detect and project index. Manual lines win on conflict.",
  autoConvert:
    "Runs Convert to Katalon locators on the Locators box immediately before Generate.",
  locatorUrl:
    "URL for Preview locators and optional auto-detect on Generate. Also passed to keyword openToUrl when set.",
  pageLocale:
    "Browser locale when Playwright extracts locators (matters for Arabic/English sites).",
  autoDetect:
    "On Generate, Playwright visits Page URL and merges discovered CSS/XPath into locators.",
  locatorPreview:
    "Read-only snapshot from Preview locators. Not saved until you Generate or copy into Locators.",
  brandingPreview:
    "Filter preview to image/logo/icon lines only.",
  stream:
    "Show Groovy appearing token-by-token (slower; same final result after stream ends).",

  codeOutput:
    "Controls artifact type: test script, @Keyword class, page object, utility, API/DB helper, or auto-detect from steps.",
  aiMemory:
    "Learns waits, naming, and keywords from the indexed project. Learn + suggest is recommended when a project is active.",
  generate:
    "Builds Katalon Groovy from steps + locators + active project index. Deterministic compiler first; Gosi Brain when needed.",
  output:
    "Generated Script.groovy content. Copy, download, or push to your local Katalon project folder.",
  exportKatalon:
    "Writes a new Test Case under your Katalon project path on this machine.",
  download:
    "Save the script as a .groovy file.",
  history:
    "Click a past run to reload its Groovy into the editor.",
} as const;

export const FLOW_STEPS = [
  "Optional: upload a Katalon project (.zip/.rar) and set it as Active project.",
  "Enter test steps on Manual, CSV, Jira, or Record (Web only).",
  "Choose Code output (Auto, test script, custom keyword, page object, utility, etc.).",
  "Add locators manually, from Page URL preview/auto-detect, or from recording.",
  "Click Generate Katalon Groovy — script appears on the right.",
  "Copy, download .groovy, or Add to Katalon Project (local folder path).",
  "For failed runs: open Gosi Brain Failure Analyzer tab and paste Katalon execution logs only.",
  "For API tests: open API Test — paste Swagger, Postman, cURL, or endpoint JSON; copy helpers and Scripts/API tests.",
  "For load tests: open Performance Test — same API input → JMeter (.jmx), k6 script, and performance strategy report.",
  "For natural-language QA tasks: open Gosi Brain Workspace (header) — chat to generate scripts, analyze projects, APIs, and load tests.",
] as const;

/** Gosi Brain QA Chat Workspace — conversational orchestration layer. */
export const AI_WORKSPACE_STEPS = [
  "Click Gosi Brain Workspace in the header (or open /ai-workspace).",
  "Set Context on the left: Active project, Platform, Gosi Brain memory mode, and optional current tab name.",
  "Optional: paste OpenAPI/Swagger or Postman collection JSON for API and performance requests.",
  "Type a request in plain language — e.g. “Generate login API tests”, “Analyze flaky locators”, “Run Project Analyze”.",
  "Press Enter or Send. The assistant routes to the right agent (script, API, performance, project intelligence, healing, review).",
  "Review the reply: markdown explanation, expandable code/assets, intent/agent badges, and follow-up suggestions.",
  "Use suggested prompt chips for the next action; start New chat to reset the session.",
  "Gosi Brain enriches advisory replies when configured; deterministic generation still runs through the orchestrator.",
] as const;

export const AI_WORKSPACE_HINT =
  "Example: “Generate smoke k6 strategy from attached OpenAPI” with Swagger in context — routes to Performance Agent and returns strategy JSON + k6 starter. With a project selected, “Analyze my project” runs Project Analyze v2 and summarizes risk score and fixes.";

/** Gosi Brain Coverage Analyzer — gap and risk intelligence. */
export const COVERAGE_ANALYZER_STEPS = [
  "Open Coverage from the header (or /coverage) after uploading and indexing a Katalon project.",
  "Select the project and optionally paste OpenAPI/Swagger for API coverage gap detection.",
  "Click Analyze coverage — scans scripts, OR, keywords, business flows, and assertions.",
  "Review overview cards: overall coverage %, risk score, maintainability, missing scenarios.",
  "Use the module heatmap and drilldown table to prioritize high-risk areas.",
  "Read Gosi Brain recommendations for unused OR, weak assertions, duplicate flows, and untested APIs.",
  "Force refresh after re-uploading the project or changing the spec.",
] as const;

export const COVERAGE_ANALYZER_HINT =
  "Example: Checkout module shows 45% coverage with gaps for declined card and empty cart — recommendations suggest negative payment API tests and stronger WebUI.verify usage. Analysis is read-only; no scripts or OR are modified automatically.";

export const REFACTOR_ASSISTANT_STEPS = [
  "Open Refactor from the header (or /refactor) after uploading and indexing a Katalon project.",
  "Select the project and click Analyze framework.",
  "Review maintainability, duplication, OR health, assertion quality, and wait stability scores.",
  "Prioritize recommendations by severity — each includes why, impact, and before/after preview.",
  "Use the duplication heatmap and duplicate-flow table to plan shared Custom Keywords.",
  "Drill into OR and keyword problems for cleanup and modularization.",
  "Apply fixes manually in Katalon Studio — this tool never auto-modifies your project.",
  "Force refresh after re-uploading the project.",
] as const;

export const REFACTOR_ASSISTANT_HINT =
  "Example: Login flow repeated in 14 scripts — recommendation suggests common.AuthKeywords.login with before/after Groovy preview. Thread.sleep usages are flagged with WaitHelper alternatives. All changes require your approval.";

/** API Test tab — code-only API automation. */
export const API_GENERATOR_STEPS = [
  "Open the API Test tab (next to Gosi Brain Failure Analyzer).",
  "Choose input: Endpoint (method + request/response JSON), Swagger (JSON/YAML), Postman collection, or cURL.",
  "With an Active project, existing API RequestObjects are reused when names match.",
  "Click Generate Katalon code. Review the preview (endpoints, negative/boundary scenarios), then pick a file from the dropdown.",
  "Copy helpers into Keywords/api/ (ApiPayloadBuilder, ApiRequestBuilder, ResponseValidator, TokenManager, ApiRetryHelper).",
  "Copy the test script into Scripts/API/. Tests use real payload mutations via ApiPayloadBuilder.withBody — not duplicate sendRequest without changes.",
  "Enable Gosi Brain memory (team style) when a project is active to align assertion and helper style with your team.",
  "Click Generate Postman Collection for v2.1 JSON with folders, pm.test scripts, auth, and environments.",
] as const;

export const API_GENERATOR_HINT =
  "Example: POST /login with request {\"username\":\"admin\",\"password\":\"***\"} and response {\"token\":\"…\"} generates happy-path WS tests plus negative cases (invalid password, empty username) and boundary cases (max length, null). Secrets stay in GlobalVariable / profiles — never hardcoded in generated Groovy.";

/** Performance Test tab — JMeter + k6 from API definitions. */
export const PERFORMANCE_TEST_STEPS = [
  "Open the Performance Test tab (next to API Test).",
  "Use the same inputs as API Test: Swagger/OpenAPI, Postman collection, cURL, or endpoint JSON.",
  "Optional: enable Use APIs from Project Intelligence when an Active project is indexed.",
  "Choose load mode: Smoke, Baseline, Stress, Spike, or Soak — set virtual users, duration, ramp-up, and environment.",
  "Generate JMeter (.jmx), k6 script only, or Full Suite (both plus strategy report).",
  "Convert Postman → Load Test maps folders to scenarios and preserves request chaining.",
  "Review output tabs: JMeter XML, k6 JavaScript, and Strategy (scenarios, risk notes, SLA hints).",
  "Download .jmx, k6 .js, or strategy JSON — run in JMeter or k6 CLI; no live execution from this app.",
] as const;

export const PERFORMANCE_TEST_HINT =
  "Example: OpenAPI with /login and /orders — smoke mode generates low-VU plans with auth extractors first, grouped k6 stages, and a strategy report flagging payment endpoints for capped load.";

/** Gosi Brain Failure Analyzer — log-only debugging. */
export const FAILURE_ANALYZER_STEPS = [
  "Open the Gosi Brain Failure Analyzer tab (next to Record).",
  "Paste Katalon Studio execution logs in the primary box — .log output, console text, or report excerpt.",
  "You do not need a stacktrace, screenshot, or HAR. Optional fields add extra confidence only.",
  "Click Analyze failure. Review root cause, flaky probability, detected patterns, and suggested fixes.",
  "With an Active project, the analyzer matches failing keywords and Object Repository paths from your index.",
  "Fix recommendations follow your project style when Gosi Brain memory is enabled (e.g. WaitHelper vs WebUI.delay()).",
] as const;

export const FAILURE_ANALYZER_HINT =
  "Example log lines: [INFO] WebUI.click(...), [FAILED] Unable to click on object 'Page/btn_Login', StepFailedException. The engine infers timing, locator, API, and assertion issues from patterns.";

/** Code output dropdown — what Generate produces. */
export const CODE_OUTPUT_STEPS = [
  "Auto detect: normal test steps → test script; phrases like “create keyword” → keyword class.",
  "Test script: standard Katalon test case Groovy (WebUI/Mobile/WS).",
  "Custom keyword: wraps your steps in an @Keyword class (even without “create keyword” in text).",
  "Page object / utility class / framework helper: wraps steps into the matching artifact type.",
  "API helper / DB utility / framework service: scaffolds service-style classes; web-only steps may show a warning.",
  "Pick the type you need before Generate — the right panel title reflects the mode.",
] as const;

export const CODE_OUTPUT_HINT =
  "Use Custom keyword when you want reusable methods from plain steps (e.g. visit + click) without writing “create keyword” in the step list.";

export const AI_MEMORY_STEPS = [
  "Available when an Active project is selected (after upload/index).",
  "Learn only: scans project on upload; does not change generation.",
  "Learn + suggest (default): injects team naming, waits, and keyword preferences into LLM paths.",
  "Fully adaptive: also scores output against learned patterns.",
  "Helps Generate, Failure Analyzer, and API Test match assertion style, helper layout, and naming your team uses.",
] as const;

/** End-to-end flow when using Katalon Project Intelligence. */
export const PROJECT_INTELLIGENCE_STEPS = [
  "Export or zip your full Katalon Studio project (Object Repository, Keywords, Scripts/ or Test Cases/, Profiles).",
  "Upload the .zip or .rar here and wait until indexing finishes (OR, keyword, and script counts appear).",
  "Choose Active project so Generate runs against that index.",
  "Pick Generation mode: Strict reuse (safest), Balanced (default), or Generate everything (hints only).",
  "Use Search and the OR / Keywords / Test scripts / Reusable flows tabs to find exact names from your repo.",
  "Click Project Analyze for script fixes, OR healing proposals, dependency graph, risk score, and flaky flags.",
  "Click any indexed test script to auto-fix Groovy (waits, OR paths, Thread.sleep → WebUI.delay).",
  "Click any Object Repository row to heal locators — optional Page URL enables Playwright DOM analysis.",
  "After analysis, use Download docs (PDF) for a formatted project report.",
  "Write steps using OR labels (e.g. click button_Show more) or keywords; Generate Katalon Groovy uses findTestObject and CustomKeywords when matches are confident.",
] as const;

export const PROJECT_INTELLIGENCE_HINT =
  "Match names to what you see in the explorer. Class names are case-sensitive (e.g. WebUiHelpers vs WebUIHelpers). Re-upload after big project changes.";
