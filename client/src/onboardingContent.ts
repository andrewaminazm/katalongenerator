import {
  FLOW_STEPS,
  PROJECT_INTELLIGENCE_HINT,
  PROJECT_INTELLIGENCE_STEPS,
  FAILURE_ANALYZER_STEPS,
  FAILURE_ANALYZER_HINT,
  API_GENERATOR_STEPS,
  API_GENERATOR_HINT,
  PERFORMANCE_TEST_STEPS,
  PERFORMANCE_TEST_HINT,
  AI_WORKSPACE_STEPS,
  AI_WORKSPACE_HINT,
  COVERAGE_ANALYZER_STEPS,
  COVERAGE_ANALYZER_HINT,
  REFACTOR_ASSISTANT_STEPS,
  REFACTOR_ASSISTANT_HINT,
  CODE_OUTPUT_STEPS,
  CODE_OUTPUT_HINT,
  AI_MEMORY_STEPS,
} from "./fieldTips";

export const ONBOARDING_STORAGE_KEY = "katalon:onboarding_complete";

export function isOnboardingComplete(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
}

export function markOnboardingComplete(): void {
  localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
}

export function resetOnboardingForTour(): void {
  localStorage.removeItem(ONBOARDING_STORAGE_KEY);
}

export type WizardSlide = {
  id: string;
  title: string;
  body: string[];
};

export const WIZARD_SLIDES: WizardSlide[] = [
  {
    id: "basics",
    title: "Generate Katalon Groovy",
    body: [
      "Write test steps in plain language (one action per line) on Manual, CSV, or Jira.",
      "Set Code output (Auto or test script / custom keyword / page object / utility).",
      "Add locators or use Page URL auto-detect; with an Active project, OR names resolve from your repo.",
      "Click Generate Katalon Groovy — copy, download, or Add to Katalon Project.",
    ],
  },
  {
    id: "project",
    title: "Project intelligence — upload & index",
    body: [
      "Export or zip your full Katalon Studio project (Object Repository, Keywords, Scripts, Profiles).",
      "Upload the .zip or .rar under Project intelligence and wait for indexing (OR, keyword, script counts).",
      "Select Active project and Generation mode (Balanced is default).",
      "Browse OR, Keywords, Test scripts, and Reusable flows tabs — names must match your repo exactly.",
      PROJECT_INTELLIGENCE_HINT,
    ],
  },
  {
    id: "projectAnalyze",
    title: "Project Analyze & PDF docs",
    body: [
      "With an Active project selected, click Project Analyze for a full repo health pass.",
      "Review script fixes (original vs fixed), OR locator proposals, risk score (0–100), and flaky test flags.",
      "Click any test script row for one-click Groovy fixes (waits, OR paths, Thread.sleep → WebUI.delay).",
      "Click any Object Repository row to rank locators; add a Page URL in the panel for Playwright DOM analysis.",
      "When analysis finishes, use Download docs (PDF) for a shareable project report.",
    ],
  },
  {
    id: "failure",
    title: "Gosi Brain Failure Analyzer",
    body: [
      "Open the Gosi Brain Failure Analyzer tab when a test fails.",
      "Paste Katalon execution logs only — no stacktrace or screenshot required.",
      "Get root cause, flaky probability, detected patterns, and Katalon-specific fix suggestions.",
      FAILURE_ANALYZER_HINT,
    ],
  },
  {
    id: "api",
    title: "API Test",
    body: [
      "Open the API Test tab to produce Katalon API test code only — no live API execution.",
      "Paste Swagger (JSON/YAML), Postman collection, cURL, or define an endpoint with sample request/response JSON.",
      "Generated output is split: Keywords/api helpers and Scripts/API test cases with real payload mutations.",
      API_GENERATOR_HINT,
    ],
  },
  {
    id: "aiWorkspace",
    title: "Test Architect Chat",
    body: [
      "Open Test Architect Chat from the sidebar — a chat-first QA engineering surface.",
      "Set Active project and optional Swagger/Postman in the context panel so the assistant stays project-aware.",
      "Ask in natural language: generate Groovy, API suites, load strategies, Project Analyze, locator healing, or architecture advice.",
      "The system routes your message to specialized agents and returns code, reports, and follow-up suggestions.",
      AI_WORKSPACE_HINT,
    ],
  },
  {
    id: "performance",
    title: "Performance Test",
    body: [
      "Open the Performance Test tab (next to API Test) — JMeter and k6 output only, no live runs here.",
      "Use Swagger/OpenAPI, Postman, cURL, or endpoint JSON; optionally pull APIs from your Active project index.",
      "Choose load mode: Smoke, Baseline, Stress, Spike, or Soak — set virtual users, duration, ramp-up, and environment.",
      "Generate JMeter (.jmx), k6 script, or Full Suite (both plus a strategy report with scenarios and SLA hints).",
      "Postman → Load Test maps folders to scenarios and preserves request chaining (auth extractors first).",
      "Download .jmx, k6 .js, or strategy JSON and run in JMeter or k6 CLI on your machine.",
      PERFORMANCE_TEST_HINT,
    ],
  },
  {
    id: "tips",
    title: "Tips while you work",
    body: [
      "Use the ? menu and i icons next to fields for detailed help on every tab.",
      "Try example templates under Manual to fill sample steps in one click.",
      "Use Page URL preview/auto-detect to fill locators; Mobile uses the Appium panel when Platform is Mobile.",
      "Enable Gosi Brain memory (team style) so Generate, Failure Analyzer, and API Test match your project conventions.",
      "Use Test Architect Chat for multi-step QA questions without switching tabs.",
    ],
  },
];

export type HelpTopicId =
  | "tool"
  | "project"
  | "failure"
  | "apiGenerator"
  | "performanceTest"
  | "aiWorkspace"
  | "coverageAnalyzer"
  | "refactorAssistant"
  | "codeOutput"
  | "aiMemory";

export const HELP_TOPICS: Record<
  HelpTopicId,
  { title: string; steps: readonly string[]; hint?: string }
> = {
  tool: {
    title: "How to use this tool",
    steps: FLOW_STEPS,
    hint: "Click the i icon next to any field or button for field-level help.",
  },
  project: {
    title: "Project intelligence",
    steps: PROJECT_INTELLIGENCE_STEPS,
    hint: PROJECT_INTELLIGENCE_HINT,
  },
  failure: {
    title: "Gosi Brain Failure Analyzer",
    steps: FAILURE_ANALYZER_STEPS,
    hint: FAILURE_ANALYZER_HINT,
  },
  apiGenerator: {
    title: "API Test",
    steps: API_GENERATOR_STEPS,
    hint: API_GENERATOR_HINT,
  },
  performanceTest: {
    title: "Performance Test",
    steps: PERFORMANCE_TEST_STEPS,
    hint: PERFORMANCE_TEST_HINT,
  },
  aiWorkspace: {
    title: "Test Architect Chat",
    steps: AI_WORKSPACE_STEPS,
    hint: AI_WORKSPACE_HINT,
  },
  coverageAnalyzer: {
    title: "Gosi Brain Coverage Analyzer",
    steps: COVERAGE_ANALYZER_STEPS,
    hint: COVERAGE_ANALYZER_HINT,
  },
  refactorAssistant: {
    title: "Gosi Brain Refactoring Assistant",
    steps: REFACTOR_ASSISTANT_STEPS,
    hint: REFACTOR_ASSISTANT_HINT,
  },
  codeOutput: {
    title: "Code output modes",
    steps: CODE_OUTPUT_STEPS,
    hint: CODE_OUTPUT_HINT,
  },
  aiMemory: {
    title: "Gosi Brain memory (team style)",
    steps: AI_MEMORY_STEPS,
    hint: "Requires an uploaded and selected project. Re-upload after large project changes.",
  },
};

export type StepTemplate = {
  id: string;
  label: string;
  steps: string;
  pageUrl?: string;
};

export const STEP_TEMPLATES: StepTemplate[] = [
  {
    id: "open-click",
    label: "Open site + click",
    pageUrl: "https://www.example.com",
    steps: [
      "use keyword common.WebUiHelpers.openToUrl",
      "click p_The General",
    ].join("\n"),
  },
  {
    id: "login",
    label: "Login flow",
    pageUrl: "https://www.example.com/login",
    steps: [
      "visit https://www.example.com/login",
      "click btn_Login",
      "type input_Username admin",
      "type input_Password your_password",
      "click btn_Submit",
    ].join("\n"),
  },
  {
    id: "search",
    label: "Search flow",
    pageUrl: "https://www.google.com",
    steps: ["visit https://www.google.com", "search for Katalon Studio", "press enter"].join("\n"),
  },
];
