import {
  FLOW_STEPS,
  PROJECT_INTELLIGENCE_HINT,
  PROJECT_INTELLIGENCE_STEPS,
  FAILURE_ANALYZER_STEPS,
  FAILURE_ANALYZER_HINT,
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
      "Write test steps in plain language (one action per line) on Manual, CSV, Jira, or Record.",
      "Set Code output (Auto or test script / custom keyword / page object / utility).",
      "Add locators or use Page URL auto-detect; with an Active project, OR names resolve from your repo.",
      "Click Generate Katalon Groovy — copy, download, or Add to Katalon Project.",
    ],
  },
  {
    id: "project",
    title: "Project intelligence (optional)",
    body: [
      "Upload a full Katalon Studio .zip or .rar under Project intelligence.",
      "Select Active project and Generation mode (Balanced is default).",
      "Steps like click button_Login or use keyword common.WebUiHelpers.openToUrl map to findTestObject and CustomKeywords.",
      "Enable AI memory (team style) to learn waits, naming, and keyword patterns from your project.",
    ],
  },
  {
    id: "failure",
    title: "AI Failure Analyzer",
    body: [
      "Open the AI Failure Analyzer tab when a test fails.",
      "Paste Katalon execution logs only — no stacktrace or screenshot required.",
      "Get root cause, flaky probability, detected patterns, and Katalon-specific fix suggestions.",
      FAILURE_ANALYZER_HINT,
    ],
  },
  {
    id: "tips",
    title: "Tips while you work",
    body: [
      "Use the ? menu and i icons next to fields for detailed help.",
      "Try example templates under Manual to fill sample steps in one click.",
      "Record (Web) fills locators; Mobile uses the Appium panel when Platform is Mobile.",
      PROJECT_INTELLIGENCE_HINT,
    ],
  },
];

export type HelpTopicId = "tool" | "project" | "failure" | "codeOutput" | "aiMemory";

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
    title: "AI Failure Analyzer",
    steps: FAILURE_ANALYZER_STEPS,
    hint: FAILURE_ANALYZER_HINT,
  },
  codeOutput: {
    title: "Code output modes",
    steps: CODE_OUTPUT_STEPS,
    hint: CODE_OUTPUT_HINT,
  },
  aiMemory: {
    title: "AI memory (team style)",
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
