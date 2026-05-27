import type { DocSection } from "./types";

export const DOC_SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    category: "getting-started",
    summary: "Platform overview, first script, and where each capability lives.",
    keywords: ["welcome", "overview", "onboarding", "first test"],
    content: `Katalon Script Generator turns plain-language test steps into production-ready Katalon Groovy. You can work without a project (generic WebUI/Mobile keywords) or upload a Katalon Studio archive so generation reuses your Object Repository and Custom Keywords.

The main workspace has input tabs on the left (Manual, CSV, Jira, Gosi Brain Failure Analyzer, API Test, Performance Test) and generated output on the right. Project Intelligence lives in the lower panel for upload, indexing, and Project Analyze.

Open **Gosi Brain Workspace** from the header (/ai-workspace) for a conversational QA layer — generate scripts, analyze projects, and plan API/performance work in natural language.

This documentation center is independent of the generator UI. Bookmark /how-to-use or open it from the header **Documentation** button when onboarding new team members.`,
    steps: [
      "Confirm the backend is healthy (header badge shows API status).",
      "Optional: upload a Katalon .zip/.rar under Project intelligence and set Active project.",
      "On Manual, enter one action per line (e.g. visit https://example.com, click btn_Login).",
      "Add locators or a Page URL for auto-detect if elements are not in your OR index.",
      "Choose Code output (Auto is fine for most teams) and click Generate Katalon Groovy.",
      "Copy, download, or Add to Katalon Project on the output panel.",
    ],
    tips: [
      "Use the ? menu Quick tour for a guided walkthrough without leaving the generator.",
      "Hover i icons beside fields and header links (Documentation, Gosi Brain Workspace) for contextual help.",
    ],
    warnings: [
      "Generation does not execute tests in Katalon Runtime — you still run scripts in Katalon Studio or CI.",
    ],
    mistakes: [
      "Skipping project upload when steps reference OR names — matches will be generic without an index.",
      "Putting multiple actions on one line — the engine expects one step per line.",
    ],
    mediaPlaceholders: ["Platform layout — input tabs and output panel"],
  },
  {
    id: "manual-test-generation",
    title: "Manual Test Generation (WebUI + Mobile)",
    category: "generation",
    summary: "Write steps in plain language and produce WebUI or Mobile Groovy.",
    keywords: ["manual", "webui", "mobile", "steps", "generate", "groovy"],
    content: `The Manual tab is the default path for UI automation. Steps are parsed line-by-line into a deterministic Groovy pipeline, with optional Gosi Brain enrichment when configured.

For Web, keywords map to WebUI.* and findTestObject when an Active project matches OR names. For Mobile, switch Platform to Mobile and use the Appium panel for session + locator extraction before generating Mobile.* style calls.`,
    steps: [
      "Select Platform: Web or Mobile.",
      "Enter steps — one action per line (visit, click, type, use keyword …).",
      "With an Active project, reference OR labels (click button_Login) or keywords (use keyword pkg.Class.method).",
      "Fill Locators (name = selector) and/or Page URL + Auto-detect on Generate.",
      "Set Code output: Auto, test script, custom keyword, page object, utility, etc.",
      "Click Generate Katalon Groovy and review lint hints on the output panel.",
    ],
    examples: [
      "visit https://www.example.com/login",
      "click btn_Login",
      "type input_Username admin",
      "type input_Password secret",
      "use keyword common.WebUiHelpers.openToUrl",
    ],
    tips: [
      "Try Step templates under Manual for ready-made flows.",
      "Stream mode shows tokens as they arrive — same final script when complete.",
    ],
    warnings: [
      "Mobile recording is Web-only; use Appium tools for device flows.",
    ],
    mistakes: [
      "Wrong keyword class casing (WebUiHelpers vs WebUIHelpers) — must match the indexed project.",
      "Leaving Page URL empty while expecting auto-detect to run.",
    ],
    mediaPlaceholders: ["Manual tab with sample steps", "Generated Script.groovy output"],
  },
  {
    id: "api-automation",
    title: "API Automation Tab",
    category: "generation",
    summary: "Swagger, Postman, cURL, or JSON → Katalon API tests and helpers.",
    keywords: ["api test", "swagger", "openapi", "rest", "katalon api"],
    content: `Open the API Test tab to generate Katalon API automation artifacts only — the app does not execute live HTTP calls. Inputs include Swagger/OpenAPI (JSON/YAML), Postman collections, cURL snippets, or hand-built endpoint definitions with sample request/response JSON.

Output is organized into API helpers/keywords and test scripts with realistic payload mutations, chained variables, and schema-aware assertions when sample bodies are provided.`,
    steps: [
      "Open the API Test tab.",
      "Paste Swagger, Postman JSON, cURL, or define endpoints with method, path, and samples.",
      "Optionally enable APIs from Project Intelligence when a project is indexed.",
      "Review generated folders: Keywords/api helpers and Scripts/API cases.",
      "Copy or download artifacts; import into Katalon Studio manually.",
    ],
    examples: [
      "POST /api/v1/login with JSON body → auth token stored for subsequent GET /orders",
      "OpenAPI with multiple tags → semantic folder per resource",
    ],
    tips: [
      "Provide example response JSON to improve assertion quality.",
      "Use Postman variables — they are mapped to Groovy variables where possible.",
    ],
    warnings: [
      "Secrets in Postman collections are exported as placeholders — rotate before CI.",
    ],
    mistakes: [
      "Expecting the tool to hit real environments — generation is export-only.",
    ],
    mediaPlaceholders: ["API Test input panel", "Split Keywords / Scripts output"],
  },
  {
    id: "performance-testing",
    title: "Performance Testing (JMeter + k6)",
    category: "generation",
    summary: "Load scripts and strategy reports from the same API definitions.",
    keywords: ["jmeter", "k6", "load test", "stress", "spike", "soak", "performance"],
    content: `The Performance Test tab reuses API definitions (Swagger, Postman, cURL, endpoint JSON) to produce JMeter (.jmx), k6 JavaScript, or a Full Suite (both plus strategy). Load modes include Smoke, Baseline, Stress, Spike, and Soak with configurable virtual users, duration, ramp-up, and environment tags.

Postman → Load Test preserves folder structure as scenarios and prioritizes auth extractors. Run generated files locally with JMeter or k6 CLI — not inside this web app.`,
    steps: [
      "Open Performance Test (next to API Test).",
      "Provide the same API input as API Test; optionally pull from Active project.",
      "Choose load mode and tuning (VUs, duration, ramp-up).",
      "Select output: JMeter, k6, or Full Suite.",
      "Download .jmx, .js, or strategy JSON and execute in your perf toolchain.",
    ],
    tips: [
      "Start with Smoke before Stress on payment or auth-critical paths.",
      "Read the Strategy tab for SLA hints and risk notes per endpoint.",
    ],
    warnings: [
      "High VU counts in generated plans are templates — validate against environment capacity.",
    ],
    mistakes: [
      "Running k6 scripts without installing k6 locally.",
    ],
    mediaPlaceholders: ["Load mode selector", "JMeter / k6 / Strategy tabs"],
  },
  {
    id: "ai-coverage-analyzer",
    title: "AI Coverage Analyzer",
    category: "intelligence",
    summary: "Coverage gaps, risk heatmaps, and QA architecture recommendations for indexed projects.",
    keywords: ["coverage", "sonar", "gaps", "risk", "heatmap", "unused or", "weak assertion"],
    content: `AI Coverage Analyzer (/coverage) scans an indexed Katalon project like SonarQube for QA automation: module coverage scores, assertion strength, unused OR/keywords, duplicate flows, business-flow gaps, and optional API spec coverage.

It builds on Project Intelligence graph data and reads script sources for verify/action ratios. Results are cached until the project index changes. The tool never modifies your project — analyze and recommend only.`,
    steps: [
      "Upload and index a project on the generator, then open Coverage from the header.",
      "Select the project; paste OpenAPI/Swagger optionally for API gap analysis.",
      "Run Analyze coverage and review overall score, risk, and maintainability cards.",
      "Inspect the module heatmap — darker/warmer cells need attention first.",
      "Open Gosi Brain recommendations for actionable items (unused assets, weak validations, duplicates).",
      "Check Business flows for Login, Checkout, Search, etc. and listed edge-case gaps.",
      "Use Force refresh after project re-upload or spec updates.",
    ],
    tips: [
      "Pair with Project Analyze for script/OR fixes after identifying gaps.",
      "Paste the same Swagger you use in API Test and Performance Test for consistent API coverage.",
    ],
    warnings: [
      "Coverage scores are heuristic — validate priorities with your product risk matrix.",
      "Large projects analyze up to 150 scripts per run for performance.",
    ],
    mistakes: [
      "Analyzing before indexing completes — wait for OR/keyword counts on upload.",
      "Expecting automatic test creation — use Gosi Brain Workspace or generator tabs to implement fixes.",
    ],
    mediaPlaceholders: ["Coverage dashboard with heatmap and recommendation panel"],
  },
  {
    id: "ai-refactoring-assistant",
    title: "AI Refactoring Assistant",
    category: "intelligence",
    summary: "Maintainability analysis, duplicate-flow extraction, and framework architecture recommendations.",
    keywords: [
      "refactor",
      "maintainability",
      "duplication",
      "keyword extraction",
      "or cleanup",
      "thread.sleep",
      "sonar",
    ],
    content: `AI Refactoring Assistant (/refactor) analyzes indexed Katalon projects like SonarQube + an automation architect: maintainability and duplication scores, OR/keyword health, wait stability, assertion quality, and prioritized recommendations with before/after previews.

It reuses Project Intelligence graph and script analysis. Results are cached until the project index changes. The tool never modifies scripts, OR, or keywords — analyze and recommend only.`,
    steps: [
      "Upload and index a project on the generator, then open Refactor from the header.",
      "Select the project and run Analyze framework.",
      "Review score cards: maintainability, duplication health, OR health, assertions, waits.",
      "Work through top recommendations — each explains why, impact, and suggested fix.",
      "Use the duplication heatmap and duplicate-flow table to plan shared Custom Keywords.",
      "Inspect OR and keyword drilldowns for cleanup and modularization.",
      "Apply changes manually in Katalon Studio.",
      "Use Force refresh after re-uploading the project.",
    ],
    tips: [
      "Pair with Coverage Analyzer for gap detection, then Refactor for structural improvements.",
      "Use Project Analyze for automated script/OR fix previews after choosing what to refactor.",
    ],
    warnings: [
      "Before/after examples are suggestions — review in Studio before committing.",
      "Large projects analyze up to 150 scripts per run.",
    ],
    mistakes: [
      "Expecting automatic refactoring — all changes require explicit approval in Studio.",
      "Ignoring wait-stability findings — Thread.sleep is a common flakiness source.",
    ],
    mediaPlaceholders: ["Refactoring dashboard with score cards and recommendation panel"],
  },
  {
    id: "ai-project-generator",
    title: "AI Katalon Project Generator",
    category: "intelligence",
    summary:
      "Generate complete enterprise Katalon projects: structure, OR, pages, keywords, suites, docs, dependency graph, and framework health.",
    keywords: [
      "project generator",
      "framework generator",
      "katalon project",
      "scaffold",
      "page object model",
      "keyword driven",
      "enterprise framework",
      "object repository",
      "test suites",
      "health score",
    ],
    content: `AI Katalon Project Generator (/project-generator) produces a full enterprise-ready Katalon project package — not just scripts. It scaffolds a maintainable automation architecture (folders + modules), generates starter Object Repository structure with healing metadata, Page Objects, reusable Custom Keywords, suites, documentation, and an initial dependency graph + framework health indicators.

The generator is **additive and safe**: it does not overwrite your uploaded projects. If you select a Source project, it can reuse naming conventions and style hints from Project Intelligence and AI Memory (strict reuse / balanced / generate everything).`,
    steps: [
      "Open AI Project Generator from the Gosi Brain sidebar.",
      "Set Project name, Framework type (UI/API/Mobile/Performance/Hybrid), Pattern, Domain, and Project size.",
      "Optional: select a Source project + reuse mode to align with your existing OR/keywords/style.",
      "Add Modules and Business flows (one per line) for a more accurate architecture plan.",
      "Click Analyze to preview inferred modules/flows and estimated file count.",
      "Click Generate project to produce the full structure, health score, and a downloadable zip.",
      "Import the zip into Katalon Studio and evolve the skeleton into your team’s final framework.",
    ],
    tips: [
      "Start with Hybrid + Layered for enterprise teams, then refine modules and flow services as you learn the AUT.",
      "Use Strict reuse when you must match an existing repository’s OR paths and keyword names.",
      "Review Health findings and fix duplicated patterns early to avoid framework drift.",
    ],
    warnings: [
      "The generated project is a scaffold — connect real locators, APIs, credentials, and environment profiles before CI.",
      "Generation is export-only — it does not execute tests or call live endpoints.",
    ],
    mistakes: [
      "Leaving Project name empty — required for generation.",
      "Choosing Strict reuse without a well-indexed source project (OR/keywords) — may limit what can be reused.",
    ],
    mediaPlaceholders: ["AI Project Generator page with architecture preview + structure/health panels"],
  },
  {
    id: "ai-qa-workspace",
    title: "AI QA Workspace",
    category: "intelligence",
    summary: "Chat-first QA engineering — intent routing, agents, and project-aware context.",
    keywords: [
      "ai workspace",
      "chat",
      "assistant",
      "orchestrator",
      "agents",
      "conversational",
      "qa architect",
    ],
    content: `AI QA Workspace is a separate page (/ai-workspace) that turns natural-language requests into platform actions. It behaves like a senior QA architect: explains why, cites risks, and orchestrates existing engines instead of replacing the generator tabs.

An intent router classifies each message (generate, analyze, explain, heal, performance, API, document, review) and dispatches to agents: Script Generator, API Agent, Performance Agent, Project Intelligence, Healing, Review, Documentation, and QA Advisor.

Context travels with every message: active project ID, platform, Gosi Brain memory mode, optional tab name, and pasted Swagger or Postman JSON. Conversation history is stored per session on the server.`,
    steps: [
      "From the generator header, click Gosi Brain Workspace (hover the i icon for a short description).",
      "In the Context panel, select your indexed Active project and Gosi Brain memory mode (Learn + suggest recommended).",
      "Paste OpenAPI or Postman JSON when asking about API tests, negative scenarios, or load strategy.",
      "Enter a prompt — e.g. “Generate login custom keyword”, “Analyze duplicate flows”, “Create API regression suite”.",
      "Read the response: intent/agent badges, markdown explanation, expandable Groovy or report assets.",
      "Click follow-up suggestion chips or ask a chained question in the same session.",
      "Use New chat to clear history; sessions persist in localStorage for continuity.",
    ],
    examples: [
      "Generate login API tests with chained auth from attached Swagger",
      "Analyze flaky locators and summarize Project Analyze risk score",
      "Create smoke k6 strategy for payment endpoints",
      "Explain how Project Intelligence maps OR names to findTestObject",
    ],
    tips: [
      "Select the same project you use on the generator — memory and OR hints apply automatically.",
      "Shift+Enter adds a newline; Enter sends the message.",
      "Requires Gosi Brain for richest advisory text; script/API/perf agents still use deterministic pipelines when applicable.",
    ],
    warnings: [
      "The workspace does not execute tests or live HTTP calls — copy outputs into Katalon Studio, JMeter, or k6.",
      "Large Swagger/Postman pastes are truncated server-side — use focused specs for best results.",
    ],
    mistakes: [
      "Forgetting to set Active project before asking for findTestObject or Project Analyze.",
      "Expecting one chat message to run Katalon Runtime — generation is export/advisory only.",
    ],
    mediaPlaceholders: ["AI Workspace chat with context panel and suggestion chips"],
  },
  {
    id: "project-intelligence",
    title: "Project Intelligence (OR + Keywords + AI Memory)",
    category: "intelligence",
    summary: "Upload, index, analyze, and reuse your Katalon project.",
    keywords: ["project upload", "object repository", "keywords", "project analyze", "ai memory"],
    content: `Project Intelligence indexes Object Repository entries, Custom Keywords, and Groovy scripts from a uploaded Katalon Studio archive (.zip/.rar). Generation modes control reuse strictness: Strict reuse, Balanced (default), or Generate everything (hints only).

Project Analyze runs a deeper pass: script fixes, OR healing proposals, dependency graph, risk score, flaky flags, and PDF documentation download. Gosi Brain memory learns team style (waits, naming, keywords) when enabled on upload.`,
    steps: [
      "Export your Katalon project and upload the archive.",
      "Wait for indexing counts (OR, keywords, scripts).",
      "Set Active project and Generation mode.",
      "Browse OR / Keywords / Scripts / Flows tabs; click rows to fix scripts or heal locators.",
      "Click Project Analyze for full report; Download docs (PDF) when complete.",
      "Enable Gosi Brain memory (Learn + suggest) for team-consistent output.",
    ],
    tips: [
      "Re-upload after large OR or keyword refactors.",
      "Add Page URL when healing locators for Playwright DOM ranking.",
    ],
    warnings: [
      "Class names in steps are case-sensitive — match the explorer exactly.",
    ],
    mistakes: [
      "Uploading partial folders — include OR, Keywords, and Scripts/Test Cases for best matching.",
    ],
    mediaPlaceholders: ["Project explorer tabs", "Project Analyze summary banner"],
  },
  {
    id: "self-healing-locators",
    title: "Self-Healing Locators",
    category: "intelligence",
    summary: "Convert Playwright selectors and heal OR entries.",
    keywords: ["locator", "healing", "xpath", "css", "findTestObject", "convert"],
    content: `Locators can be supplied manually (Label = selector), merged from Playwright preview, auto-detected from a Page URL on Generate, or resolved from the project index as findTestObject paths.

Self-healing in Project Intelligence ranks alternative locators for OR rows, optionally using Playwright against a live page when you provide a URL. The Convert to Katalon locators action normalizes Playwright-style lines into OR-friendly entries before generation.`,
    steps: [
      "Enter locators as Name = selector (one per line) or use Preview locators from a URL.",
      "Enable Auto-convert before Generate if you want conversion in one click.",
      "With Active project, prefer OR names in steps (click MyButton) over raw CSS in steps.",
      "For healing: open Project intelligence → OR tab → click a row → run heal with optional Page URL.",
    ],
    examples: [
      "Login Button = #login-btn",
      "Submit = xpath://button[@type='submit']",
    ],
    tips: [
      "Manual locator lines win over preview duplicates on conflict.",
      "Arabic/English sites: set Page locale before preview.",
    ],
    warnings: [
      "Auto-detect requires the backend to reach the URL (network/firewall).",
    ],
    mistakes: [
      "Mixing OR path syntax inside the Locators box instead of short names.",
    ],
    mediaPlaceholders: ["Locator preview panel", "OR heal ranking list"],
  },
  // Recording mode removed from the product UI (production servers are headless).
  {
    id: "csv-import",
    title: "CSV Import",
    category: "integration",
    summary: "Bulk steps from spreadsheets and test-case exports.",
    keywords: ["csv", "spreadsheet", "import", "rows"],
    content: `The CSV tab accepts files with a Step or Description column, or exports that include a Steps column. Parsed rows appear in a table — select which rows to include, then generate Groovy the same way as Manual.`,
    steps: [
      "Open CSV tab and upload your file.",
      "Verify parsed columns and row selection checkboxes.",
      "Adjust selection to include only intended cases.",
      "Set locators, project, and code output as on Manual.",
      "Generate Katalon Groovy.",
    ],
    tips: [
      "UTF-8 CSV avoids encoding issues with non-Latin text.",
    ],
    warnings: [
      "Very wide files may slow parsing — split huge suites if needed.",
    ],
    mistakes: [
      "Uploading Excel .xlsx without exporting to CSV first.",
    ],
    mediaPlaceholders: ["CSV row selection table"],
  },
  {
    id: "jira-integration",
    title: "Jira Integration",
    category: "integration",
    summary: "Pull test steps from Jira issues into the generator.",
    keywords: ["jira", "atlassian", "issue", "PROJ-123"],
    content: `Connect with Jira base URL, email/username, and API token (Cloud) or PAT/password (Server/DC). Fetch by issue key or browse URL; steps land in an editable text area before Generate.

Use Test Jira login to validate credentials before fetching.`,
    steps: [
      "Open Jira tab; enter site root (https://company.atlassian.net).",
      "Enter credentials and Test Jira login.",
      "Enter issue key or URL; Fetch issue.",
      "Edit steps in the box if the description needs cleanup.",
      "Generate as on Manual.",
    ],
    examples: [
      "PROJ-456 → fetches description/bullets into steps",
    ],
    tips: [
      "Demo mode works without credentials for UI exploration.",
    ],
    warnings: [
      "Store tokens securely — browser local storage may persist session preferences.",
    ],
    mistakes: [
      "Using full /browse/ URL as base URL instead of site root only.",
    ],
    mediaPlaceholders: ["Jira credentials form"],
  },
  {
    id: "postman-export",
    title: "Postman Export",
    category: "integration",
    summary: "Generate Postman collections alongside Katalon API code.",
    keywords: ["postman", "collection", "export", "newman"],
    content: `From the API Test tab, generated output can include Postman collection JSON aligned with the same scenarios and variables as Katalon artifacts. Use this for partner QA teams or dual-stack pipelines (Katalon + Postman/Newman).`,
    steps: [
      "Generate from Swagger/Postman/cURL in API Test.",
      "Open the Postman preview/output section.",
      "Copy or download collection JSON.",
      "Import into Postman; set environment variables for secrets.",
    ],
    tips: [
      "Regenerate after OpenAPI changes to keep folders in sync.",
    ],
    warnings: [
      "Collections may contain example hosts — update baseUrl before production runs.",
    ],
    mistakes: [
      "Confusing API Test tab execution with Postman Runner — both are export-only here.",
    ],
    mediaPlaceholders: ["Postman collection preview"],
  },
  {
    id: "custom-keywords",
    title: "Custom Keywords",
    category: "generation",
    summary: "Generate @Keyword classes and reuse project keywords.",
    keywords: ["keyword", "CustomKeywords", "@Keyword"],
    content: `Set Code output to Custom keyword or Auto when steps imply reusable actions. With Project Intelligence, use keyword package.Class.method in steps to emit CustomKeywords.* calls that match your index.

Keyword template mode can scaffold new keywords from step lists for later refinement in Katalon Studio.`,
    steps: [
      "Index project keywords via upload.",
      "Write use keyword mypack.MyKeywords.doLogin in steps.",
      "Set Code output to Custom keyword or Auto.",
      "Generate and copy into Keywords/ folder in Studio.",
    ],
    examples: [
      "use keyword common.WebUiHelpers.openToUrl",
      "use keyword my.company.LoginKeywords.loginAsAdmin",
    ],
    tips: [
      "Strict reuse mode refuses low-confidence keyword guesses.",
    ],
    mistakes: [
      "Inventing keyword names not present in the explorer.",
    ],
    mediaPlaceholders: ["Code output = Custom keyword"],
  },
  {
    id: "groovy-utilities",
    title: "Groovy Utilities",
    category: "generation",
    summary: "Utility classes, framework helpers, and page objects.",
    keywords: ["utility", "page object", "framework helper", "groovy function"],
    content: `Code output modes include Groovy utility, Framework helper, Page object, API helper, and DB utility. The compiler routes steps into appropriate class layouts (static helpers, PO methods, etc.) for maintainable suites.`,
    steps: [
      "Choose Code output matching your artifact (e.g. Page object).",
      "Write steps describing page actions or data operations.",
      "Generate; place file under Scripts/ or Keywords/ per Katalon conventions.",
      "Wire test cases to call the new utility or PO methods.",
    ],
    tips: [
      "Page object mode groups actions by implied page from step wording.",
    ],
    warnings: [
      "Review imports and package lines before pasting into Studio.",
    ],
    mistakes: [
      "Selecting Test script when you need a reusable @Keyword class.",
    ],
    mediaPlaceholders: ["Code output dropdown options"],
  },
  {
    id: "best-practices",
    title: "Best Practices",
    category: "advanced",
    summary: "Enterprise patterns for stable, maintainable automation.",
    keywords: ["best practices", "ci", "maintainability", "flaky"],
    content: `Treat generated Groovy as a first draft — always review waits, assertions, and data. Keep one action per step, name OR objects consistently, and re-index projects after refactors.

Combine Project Analyze risk scores with Gosi Brain Failure Analyzer on CI failures. Use Performance Smoke before full Stress on shared environments.`,
    steps: [
      "Version-control Katalon projects; upload after meaningful changes.",
      "Use Balanced generation mode for daily work; Strict for regulated reuse.",
      "Run Project Analyze monthly; track risk score and flaky flags.",
      "Store secrets in Katalon profiles, not in generated scripts.",
      "Pin API/perf artifacts to OpenAPI version tags in git.",
    ],
    tips: [
      "Enable Gosi Brain memory Learn + suggest for team consistency.",
      "Prefer findTestObject over inline XPath in test cases when OR exists.",
    ],
    warnings: [
      "Do not run Stress load tests against production without approval.",
    ],
    mistakes: [
      "Editing generated scripts only in the web UI without saving back to Studio.",
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    category: "advanced",
    summary: "Common failures and how to fix them.",
    keywords: ["error", "failed", "fix", "debug", "503", "api down"],
    content: `If Generate fails, check API health in the header, step syntax (one per line), and that an Active project is set when using OR names. Recording errors often mean Playwright browsers are not installed on the server.

PDF documentation download requires Chromium via Playwright on the server (npm run playwright:install --prefix server). Jira fetch failures are usually auth or wrong base URL.`,
    steps: [
      "Verify backend health endpoint responds OK.",
      "Read error banner text on the generator — often states missing project or invalid JSON.",
      "For locators: test Page URL in browser from server network.",
      "For Jira: run Test Jira login; confirm API token scopes.",
      "For empty matches: re-upload project and confirm OR name spelling.",
    ],
    tips: [
      "Use Gosi Brain Failure Analyzer with Katalon logs for post-run debugging.",
    ],
    warnings: [
      "Gosi Brain optional — deterministic path works offline of LLM when configured.",
    ],
    mistakes: [
      "Assuming generation executes tests — always run in Katalon Studio/CI.",
    ],
    mediaPlaceholders: ["API health badge", "Error status banner"],
  },
];

export const DOC_CATEGORIES: { id: DocSection["category"]; label: string }[] = [
  { id: "getting-started", label: "Getting started" },
  { id: "generation", label: "Generation" },
  { id: "integration", label: "Integrations" },
  { id: "intelligence", label: "Intelligence" },
  { id: "advanced", label: "Advanced" },
];
