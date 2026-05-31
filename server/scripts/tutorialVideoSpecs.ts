/** Shared tutorial metadata — keep in sync with client/src/data/tutorials/videoCatalog.ts */

export type TutorialSpec = {
  id: string;
  title: string;
  description: string;
  category: string;
  /** App route to record (path + hash + query). */
  path: string;
  slides: string[];
};

export const TUTORIAL_SPECS: TutorialSpec[] = [
  {
    id: "platform-overview",
    title: "Platform overview",
    description:
      "Tour the generator layout, API health, project upload, and where Script Generator, Gosi Brain, and Utilities live.",
    category: "Getting started",
    path: "/",
    slides: [
      "Script Generator tabs: Functional, API, Performance, Failure Analyzer",
      "Gosi Brain: Workspace, Coverage, Refactor, Execution Report, Project tools",
      "Intelligence: Project upload, OR/keywords index, Gosi Brain Memory",
      "Utilities: Video Tutorials, Documentation, Generation History",
    ],
  },
  {
    id: "manual-generation",
    title: "Manual test generation (WebUI)",
    description: "Plain-language steps to Katalon Groovy with locators and code output modes.",
    category: "Script Generator",
    path: "/?tab=manual",
    slides: [
      "One action per line: visit, click, type, use keyword",
      "Add locators or Page URL for auto-detect on Generate",
      "Set Active project to reuse Object Repository names",
      "Choose Code output and click Generate Katalon Groovy",
    ],
  },
  {
    id: "api-automation",
    title: "API Test tab",
    description: "Swagger, Postman, and cURL to Katalon API keywords and test scripts.",
    category: "Script Generator",
    path: "/?tab=api",
    slides: [
      "Paste OpenAPI, Postman JSON, or cURL snippets",
      "Review semantic folders and chained variables",
      "Export Keywords and Scripts for Katalon Studio",
      "Optional Postman collection for dual-stack QA",
    ],
  },
  {
    id: "performance-testing",
    title: "Performance Test tab",
    description: "JMeter and k6 load scripts from the same API definitions.",
    category: "Script Generator",
    path: "/?tab=performance",
    slides: [
      "Reuse API input from Swagger or Postman",
      "Pick Smoke, Baseline, Stress, Spike, or Soak",
      "Download .jmx, k6 .js, or Full Suite + strategy",
      "Run locally with JMeter or k6 CLI",
    ],
  },
  {
    id: "failure-analyzer",
    title: "Gosi Brain Failure Analyzer",
    description: "Paste execution logs for root cause and fix recommendations.",
    category: "Script Generator",
    path: "/?tab=failure",
    slides: [
      "Open Failure Analyzer tab on the generator",
      "Paste Katalon Studio execution log text",
      "Review classification, flakiness, and root cause",
      "Apply suggested fixes in Studio or CI",
    ],
  },
  {
    id: "ai-workspace",
    title: "Test Architect Chat",
    description: "Chat-first QA with intent routing and project-aware agents.",
    category: "Gosi Brain",
    path: "/ai-workspace",
    slides: [
      "Select Active project and memory mode in Context",
      "Attach Swagger or Postman for API questions",
      "Ask in natural language — agents route by intent",
      "Copy Groovy, reports, or follow suggestion chips",
    ],
  },
  {
    id: "coverage-analyzer",
    title: "AI Coverage Analyzer",
    description: "Coverage gaps, heatmaps, and recommendations for indexed projects.",
    category: "Gosi Brain",
    path: "/coverage",
    slides: [
      "Upload and index a Katalon project first",
      "Run Analyze coverage on /coverage",
      "Review module heatmap and risk score",
      "Optional OpenAPI paste for API gap analysis",
    ],
  },
  {
    id: "refactoring-assistant",
    title: "AI Refactoring Assistant",
    description: "Maintainability, duplication, and architecture recommendations.",
    category: "Gosi Brain",
    path: "/refactor",
    slides: [
      "Open Refactoring Assistant from Gosi Brain",
      "Run Analyze framework on indexed project",
      "Prioritize recommendations with impact scores",
      "Apply changes manually in Katalon Studio",
    ],
  },
  {
    id: "execution-report",
    title: "AI Execution Report Generator",
    description: "Release readiness and executive PDF from CI pass/fail data.",
    category: "Gosi Brain",
    path: "/execution-report",
    slides: [
      "Enter build ID, counts, and optional failure rows",
      "Generate report for readiness and module risk",
      "Review charts and recommendations on screen",
      "Download PDF for stakeholders",
    ],
  },
  {
    id: "project-generator",
    title: "AI Katalon Project Generator",
    description: "Enterprise project scaffold with OR, keywords, and suites.",
    category: "Gosi Brain",
    path: "/project-generator",
    slides: [
      "Set framework type, pattern, and business flows",
      "Optional source project for style reuse",
      "Analyze architecture preview",
      "Generate and download importable zip",
    ],
  },
  {
    id: "project-repair",
    title: "AI Project Repair Engine",
    description: "Safe repairs with previews and downloadable archive.",
    category: "Gosi Brain",
    path: "/project-repair",
    slides: [
      "Analyze indexed project for flakiness and smells",
      "Preview repair diffs before applying",
      "Apply safe repairs conservatively",
      "Download repaired zip for Studio import",
    ],
  },
  {
    id: "project-intelligence",
    title: "Project Intelligence",
    description: "Upload, index, analyze, and heal your Katalon project.",
    category: "Intelligence",
    path: "/#project-intelligence",
    slides: [
      "Upload Katalon .zip or .rar archive",
      "Wait for OR, keyword, and script indexing",
      "Set Active project and generation mode",
      "Run Project Analyze and heal locators",
    ],
  },
  {
    id: "workspace-memory",
    title: "Test Architect Chat Memory",
    description: "Persistent flows and architecture injected into chat.",
    category: "Intelligence",
    path: "/ai-workspace",
    slides: [
      "Index memory after project upload or repair",
      "Re-index after major project changes",
      "Ask about flows, locators, and risk in Workspace",
      "Review citation chips on assistant replies",
    ],
  },
  {
    id: "documentation-center",
    title: "Documentation center",
    description: "Searchable guides, workflows, and troubleshooting.",
    category: "Utilities",
    path: "/how-to-use",
    slides: [
      "Open Documentation under Utilities",
      "Search by feature or keyword",
      "Follow step workflows and tips",
      "Use Video Tutorials for visual walkthroughs",
    ],
  },
];
