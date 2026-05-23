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
  "For failed runs: open AI Failure Analyzer tab and paste Katalon execution logs only.",
] as const;

/** AI Failure Analyzer — log-only debugging. */
export const FAILURE_ANALYZER_STEPS = [
  "Open the AI Failure Analyzer tab (next to Record).",
  "Paste Katalon Studio execution logs in the primary box — .log output, console text, or report excerpt.",
  "You do not need a stacktrace, screenshot, or HAR. Optional fields add extra confidence only.",
  "Click Analyze failure. Review root cause, flaky probability, detected patterns, and suggested fixes.",
  "With an Active project, the analyzer matches failing keywords and Object Repository paths from your index.",
  "Fix recommendations follow your project style when AI memory is enabled (e.g. WaitHelper vs WebUI.delay()).",
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
  "Helps Generate and Failure Analyzer recommend WaitHelper, Custom Keywords, and OR style your team uses.",
] as const;

/** End-to-end flow when using Katalon Project Intelligence. */
export const PROJECT_INTELLIGENCE_STEPS = [
  "Export or zip your full Katalon Studio project (Object Repository, Keywords, Scripts/ or Test Cases/, Profiles).",
  "Upload the .zip or .rar here and wait until indexing finishes (OR, keyword, and script counts appear).",
  "Choose Active project so Generate runs against that index.",
  "Pick Generation mode: Strict reuse (safest), Balanced (default), or Generate everything (hints only).",
  "Use Search and the OR / Keywords / Test scripts / Reusable flows tabs to find exact names from your repo.",
  "Write steps using OR labels (e.g. click button_Show more) or keywords (e.g. use keyword common.WebUiHelpers.openToUrl).",
  "Click Generate Katalon Groovy — output should use findTestObject('…') and CustomKeywords.* when matches are confident.",
] as const;

export const PROJECT_INTELLIGENCE_HINT =
  "Match names to what you see in the explorer. Class names are case-sensitive (e.g. WebUiHelpers vs WebUIHelpers). Re-upload after big project changes.";
