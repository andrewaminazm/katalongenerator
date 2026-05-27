# Katalon Script Generator

Production-oriented web app that converts:

- manual test steps (free-text)
- CSV files
- Jira issues
- Playwright-recorded flows

…into **Katalon Studio Groovy** scripts (WebUI / Mobile keywords).

## What’s new (latest)

- **AI API Automation Architect** (**API Test** tab): generate **enterprise-grade Katalon API Groovy** *and* **Postman Collection v2.1** from the same API input (Swagger/OpenAPI, Postman, cURL, or endpoint JSON).
- **Performance Test** tab: generate **JMeter (.jmx)**, **k6** load scripts, and a **performance strategy report** from the same API sources (smoke, baseline, stress, spike, soak).
- **Semantic API intelligence**: endpoints grouped into business modules (Authentication, Users, Orders, Payments, etc.), with chained variables (IDs/tokens), stronger validations, security + boundary scenarios, and readable payload sizes (256/512/1024 — no absurd giant strings).
- **Postman export**: download `.postman_collection.json` and `.postman_environment.json` (Local/Dev/QA/Staging/Prod templates) with reusable variables and scripts.

This repo supports two generation modes:

- **Deterministic compiler (default)**: no LLM required for compiling steps → Groovy.
- **Legacy LLM path (optional)**: uses **local Ollama** by default, with optional **Google Gemini** when `GEMINI_API_KEY` is set on the server.

## Quickstart (local dev)

Prerequisites:

- Node.js **20+**
- (Optional) Ollama running locally: `ollama serve`
- (Optional) Playwright browsers (for auto-detect locators / record): see below

Install:

```bash
npm install
npm run install:all
```

Run (frontend + backend):

```bash
npm run dev
```

Open the UI (Vite prints the actual port):

- `http://localhost:5173/`

Backend API:

- `http://localhost:8787`

Playwright (only if you use record / auto-detect locators):

```bash
cd server
npm run playwright:install
```

## How to use (UI)

1. **Select platform**: Web (WebUI) or Mobile.
2. **Paste steps** (one per line), for example:

```text
1-visit https://www.google.com/
2-click Settings
```

3. **Add locators** (`Label = selector`) if you have them:

```text
Settings = //button[contains(normalize-space(.),'Settings') or contains(@aria-label,'Settings')]
```

4. Click **Generate Katalon Groovy** to get the script on the right (copy, download `.groovy`, or **Add to Katalon Project**).

**First visit:** a short **onboarding wizard** walks through basics, project intelligence, and tips. Reopen it anytime from **?** → **Show tour again**. Use **i** icons next to fields for field-level help.

**Quick templates** (Manual tab): **Open site + click**, **Login flow**, and **Search flow** fill sample steps (and Page URL when needed) in one click.

Optional features you can enable in the UI:

- **Katalon project intelligence**: upload a full Katalon Studio `.zip` or `.rar`, browse Object Repository and Keywords, select an **active project** and **generation mode**, then Generate — the deterministic compiler reuses `findTestObject('…')` and `CustomKeywords.'…'` when matches score above threshold. See `docs/PROJECT_INTELLIGENCE_ARCHITECTURE.md`.
- **AI Groovy Function Generator** (`server/src/services/groovyArchitecture/`): enterprise helpers, page objects, API/DB utilities, login flows with retry/session/screenshot/logging — not just test steps. Example: `create reusable login helper with retry and session validation`. Code output modes include **Page object**, **API helper**, **DB utility**, **Framework service**.
- **AI Memory for test patterns**: on upload/reindex the server scans the indexed project and stores a **team style profile** under `server/data/ai-memory/{projectId}.json` (naming, waits, assertions, locator strategy, top keywords, reusable flows). Set **AI memory (team style)** when a project is active: `disabled` | `learn_only` | `learn_suggest` (default) | `adaptive`. **Learn + suggest** injects style into LLM prompts and utility AI synthesis; responses include `styleMatchScore` and helper reuse hints. `GET /api/projects/:projectId/memory` (`?refresh=1` rebuilds from index).
- **Auto-detect locators**: runs Playwright on a URL and merges results with your locator text.
- **Record mode**: opens a headed browser *on the machine running the server*, records actions, and converts them into steps/locators.
- **Convert to Katalon Locators**: converts Selenium/Cypress/Playwright locator styles into Katalon-friendly CSS/XPath.

## Performance Test (JMeter + k6)

Open the **Performance Test** tab to turn API definitions into runnable load-test assets:

- **Inputs**: Swagger/OpenAPI, Postman collection, cURL, endpoint JSON, optional **Project Intelligence** APIs
- **Load modes**: Smoke, Baseline, Stress, Spike, Soak — with VUs, duration, ramp-up, and environment (QA / Staging / Prod-like)
- **Outputs**: JMeter test plan (thread groups, samplers, CSV, headers, JSON extractors), k6 script (`options.stages`, `setup()` auth, `group()` per semantic module, checks/thresholds), scenario mapping + SLA/risk notes

**API:** `POST /api/performance/generate` — `{ inputType, swagger/spec/collection/curl/endpoint fields, mode, config: { vus, duration, rampUp, environment?, baseUrl? }, projectId?, useProjectApis? }`

---

## AI API Automation Architect (Katalon + Postman)

Open the **API Test** tab to generate production-grade API automation assets:

- **Katalon**: reusable helpers under `Keywords/api/` plus one or more scripts under `Scripts/API/` (split by semantic module when the spec is large).
- **Postman**: Collection **v2.1** with semantic folders, chained variables, pre-request scripts (requestId/correlationId/timestamp), performance assertions, security scenarios, and environments.

Supported inputs:

- Swagger/OpenAPI (JSON or YAML)
- Postman collection JSON
- cURL
- Endpoint JSON (method + path/URL + request/response examples)

UI actions:

- **Generate Katalon code**
- **Generate Postman Collection**
- **Download Groovy** (Katalon view)
- **Download Postman Collection** / **Download Environment** (Postman view)

### Custom keywords in steps

With an **active Katalon project** uploaded and indexed, reference your **Keywords** classes in plain-text steps. The deterministic compiler resolves them to `CustomKeywords.'package.Class.method'(...)` when the match is confident.

Supported patterns (one per line):

```text
use keyword common.WebUiHelpers.openToUrl("https://www.google.com/")
use keyword common.WebUiHelpers.openToUrl
use keyword safeCloseBrowser()
CustomKeywords.'common.WebUiHelpers.safeCloseBrowser'()
```

| Pattern | Notes |
|---------|--------|
| Full path | `use keyword common.WebUiHelpers.openToUrl` — best when multiple keyword classes exist |
| Method only | `use keyword safeCloseBrowser()` — resolves against indexed keywords (prefers `WebUiHelpers` when ambiguous) |
| URL shorthand | `openToUrl("google")` can map to `https://www.google.com/` when the keyword expects a URL |
| `import …` lines | Treated as **comments** in generated Groovy (not executable in this tool — Katalon adds imports in Studio) |

Keyword-only flows (e.g. close browser) do **not** auto-insert `WebUI.openBrowser`. Keywords that open a browser (such as `openToUrl`) are detected so the script stays minimal.

Without an active project, keyword lines may compile to comments or unresolved placeholders — upload the project `.zip`/`.rar` and select **Active project** first.

### Create Custom Keyword classes (not test scripts)

When a step asks to **create** or **generate** a keyword (not call an existing one), the deterministic compiler emits a **Custom Keyword class** under `Keywords/` — not a test case.

Examples:

```text
create katalon keyword for login
generate keyword for search
create mobile keyword for login
create keyword class for api token generation
```

The UI shows **Mode: Custom Keyword Generator**. Output is a Groovy class with `@Keyword`, `package common`, and platform-appropriate imports (`WebUI`, `Mobile`, or `WS`). Mixed lines (keyword create + normal steps) fall back to the regular test-case compiler.

Run server tests: `cd server && npm test`

### Universal Groovy utilities (functions, helpers, services)

The platform also generates **reusable Groovy** — not only test steps or `@Keyword` classes:

```text
create groovy function for random email generation
create retry mechanism utility
create API token helper
create reusable login helper
```

Use the **Code output** dropdown (`Auto detect`, `Groovy function`, `Utility class`, `Framework helper`) or let the router infer from steps.

| Mode | Output |
|------|--------|
| `groovy_utility` | Standalone utility/helper class (`RandomDataUtils`, `RetryHelper`, …) |
| `hybrid` | Utility class + test script in one file (utility lines + click/visit steps) |
| `keyword_template` | Katalon `@Keyword` class (phrases with **keyword**, not “helper”) |

Deterministic templates cover common patterns (email, retry, date, screenshot, API token, JSON parser). When **Gosi Brain** is configured and a token is available, the server can synthesize richer utilities via AI, then validates with `groovyAstValidator` (blocks `Runtime.exec`, `ProcessBuilder`, etc.).

### Mobile (Appium) workflow

When **Platform = Mobile**, the app supports **Appium session control**, **page-source locator extraction**, and **Mobile Record mode** using a **WebDriver command log**.

#### Prerequisites (Mobile)

- Appium server running (default `http://127.0.0.1:4723`)
- A connected device/emulator (Android/iOS)
- Your Appium capabilities JSON

#### Mobile locator extraction (page source)

In the UI, use the **Mobile (Appium)** panel:

1. Enter Appium URL + capabilities JSON
2. Click **Start session**
3. Navigate to the desired screen on the device
4. Click **Extract locators**

Extracted locators are merged into the **Locators** box as `Label = selector` lines.

Locator priority (strict):

1. **Android** `resource-id`
2. `accessibility id` (Android `content-desc`, iOS `name`)
3. `text` / `label`
4. `xpath` (last resort)

Example locator lines:

```text
Login = resource-id=com.app:id/login
Username = accessibility id = username
```

#### Mobile Record mode (Appium/WebDriver command log)

Mobile recording works by running a **local proxy** that forwards WebDriver traffic to the real Appium server while logging all commands.

1. Click **Start Recording** → UI shows a **Proxy URL**
2. In **Appium Inspector** (or your test runner), set the Appium server URL to that **Proxy URL**
3. Perform actions (tap/type) on the device
4. Click **Stop Recording**
5. Click **Apply to Steps+Locators** to populate:
   - Manual steps
   - Locators box

The recorder converts WebDriver commands into steps like:

```text
tap login
type username "john"
```

## Deterministic compiler vs LLM mode

- **Deterministic (recommended)**:
  - always emits a script (uses safe fallbacks when needed)
  - includes waits before interactions
  - performs Groovy validation + linting
- **LLM mode (`deterministicCompiler: false`)**:
  - uses Ollama or Gemini to draft Groovy
  - still runs web post-processing + lint

If a step cannot be matched to any locator label, the compiler uses a **fallback XPath** like:

```xpath
//*[contains(normalize-space(.),'Settings')]
```

This prevents silent wrong matches (for example, “click Settings” incorrectly clicking “Google Search”).

## Documentation (PDF)

- **Full project guide (Markdown)**: `docs/PROJECT_GUIDE.md`
- **Full project guide (PDF)**: `docs/PROJECT_GUIDE.pdf`
- **End-user guide — how to use every tab (Markdown)**: `docs/USER_GUIDE.md`
- **End-user guide (PDF)**: `docs/USER_GUIDE.pdf` — rebuild with `npm run docs:user-pdf`

## Architecture

| Layer | Stack |
|--------|--------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Node.js 20+ + Express + TypeScript |
| Locators / record | Playwright (Chromium): `/api/locators`, headful record (`/api/record/start` + poll status/result), and generate `mode: "record"` |
| AI | **Ollama** `POST /api/generate` (default `http://localhost:11434`) or **Gemini** REST (`GEMINI_API_KEY` in `.env`) |
| Groovy (web) | **Deterministic compiler** (default) + **post-processing** + **lint** — see below |
| Compiler | `server/src/services/katalonCompiler/` — action mapping, locator scoring, TestObject build, assembly, validation |

### Data flow

**Default (`deterministicCompiler` omitted or `true`):**

```
User input → merge locators (manual + auto-detect + record)
  → Universal Test Step Intelligence (DSL): classify intent (navigate, click, callKeyword, comment, …)
    → repair + validation + canonical steps
  → Test flow builder → action compiler (WebUI / Mobile + CustomKeywords when project indexed)
  → Locator lines → score & pick one strategy per label → TestObject builder
  → Script assembler (fixed order: imports → setup → TestObjects → actions → cleanup)
  → autoFix (web: normalizeKatalonWebGroovy) → validation gatekeeper → Groovy + lint + compilerWarnings
```

Key packages: `server/src/services/testDsl/` (intent classification, normalization), `server/src/services/testIntelligence/` (flow + assertions), `server/src/services/projectIntelligence/` (OR/keyword index and binding).

**Legacy LLM path (`deterministicCompiler: false`):**

```
… → Prompt builder → Ollama or Gemini → web: normalizeKatalonWebGroovy → simplify → lint
```

### Deterministic compiler modules

| Module | Role |
|--------|------|
| `locatorScorer.ts` | Priority scores (id, name, accessibilityId, css, xpath, OR path) + dynamic-id penalties |
| `locatorParser.ts` | Parse `label = rhs` lines; classify single locator type per object |
| `stepParser.ts` | Map free-text steps to intents (open, click, type, Enter, mobile tap, etc.) |
| `actionCompiler.ts` | Intents + resolved locators → ordered internal operations; state tracker for implicit Enter |
| `testObjectBuilder.ts` | One `TestObject` per label; `addProperty` once (no CSS+XPath mix) |
| `scriptAssembler.ts` | Emit Groovy in strict section order |
| `stateTracker.ts` | Last active element for `Keys.chord(Keys.ENTER)` |
| `autoFixEngine.ts` | `webUI`→`WebUI`, then web normalization |
| `validationLayer.ts` | Reject TestNG/JUnit markers, raw `findElement`, bad imports |
| `index.ts` | `compileKatalonScript()` orchestrator (`model`: `katalon-compiler-v1`) |

### Self-healing locators (optional runtime integration)

After tests fail in Katalon or during Playwright checks, **POST** structured failures to recover locators without manual edits:

| Module | Role |
|--------|------|
| `failureDetector.ts` | Normalize `{ stepId, action, failedLocator, errorType, domSnapshot? }` |
| `fallbackLocatorGenerator.ts` | Re-open URL with Playwright, resolve failed element, emit scored alternatives (id, name, data-testid, aria, css, xpath) |
| `healingScorer.ts` | Priority scores + penalties (aligned with compiler scorer) |
| `retryExecutor.ts` | Ordered retry helper (`maxRetries`, default 3) |
| `aiLocatorRepair.ts` | **Last resort:** Ollama JSON-only prompt for 3 locator objects |
| `healingMemoryStore.ts` | Persists successful fixes under `server/data/healing-memory.json` (URL host + step + DOM signature) |
| `locatorHealingEngine.ts` | Pipeline: **memory → rule-based → validate in browser → AI** |

- **`POST /api/heal/locator`** — body: `url`, `stepId`, `action`, `failedLocator: { type, value }`, optional `errorType`, `domSnapshot`, `maxRetries`, `skipAi`.
- **`GET /api/heal/memory`** — list learned locator entries.

`/api/generate` JSON responses include a **`healing`** object (unless `includeHealingMetadata: false`) pointing at these endpoints.

### Web script post-processing (`normalizeKatalonWebGroovy`)

For **`platform: "web"`**, the backend does not rely on the model alone for imports and `openBrowser` calls. It applies (in order):

1. **Strip bad Selenium imports** — Removes lines that fail in Studio (e.g. `WebDriver.LocationType`, `FRAMENAME`, invalid `WebDriver` imports).
2. **Ensure Katalon imports** — Rebuilds a **canonical import block** after leading `//` comments:
   - `FailureHandling` → `WebUI` → `TestObject` → `ConditionType` → optional `import static … findTestObject` **only if** `findTestObject(` appears → `Keys`.
3. **`WebUI.openBrowser` normalization** — Rewrites single-argument calls to `WebUI.openBrowser(url, FailureHandling.STOP_ON_FAILURE)` to avoid Groovy `MethodSelectionException` overload ambiguity.

Streaming responses are **buffered**, then run through the same pipeline so streamed output matches non-stream behavior.

### Groovy lint (non-streaming `/api/generate`)

The JSON response includes `lint`: an array of issues such as:

| Rule | Severity | Notes |
|------|----------|--------|
| `no-raw-selenium` | error | Raw Selenium / `WebDriver` usage in generated lines |
| `invalid-selenium-import` | error | Bad WebDriver-related imports (web) |
| `webui-wait-typo` | error | e.g. `waitforElementVisible` vs `waitForElementVisible` |
| `mobile-openBrowser-review` | warning | `Mobile.openBrowser` may be wrong for native/hybrid flows |
| `no-webui-on-mobile` | error | Mobile scripts must not contain `WebUI.*` |
| `no-playwright-cypress-on-mobile` | error | Mobile scripts must not contain Playwright/Cypress syntax |
| `unknown-findTestObject` | warning | OR path not in known project/locator list |
| `formatting` / `top-level-imports` | info | Style hints |

## Project structure

```
kataloncode/
├── package.json              # root: concurrently dev script
├── README.md
├── .env.example
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   ├── data/                 # history.json (created at runtime)
│   └── src/
│       ├── index.ts          # Express app
│       ├── routes/api.ts     # REST: generate, record, locators, CSV, Jira, history, katalon upload
│       ├── services/
│       │   ├── ollama.ts     # HTTP client for Ollama (stream + non-stream)
│       │   ├── gemini.ts     # Google Gemini generateContent + stream
│       │   ├── promptBuilder.ts
│       │   ├── testDsl/           # universal step intelligence (classify, normalize, validate)
│       │   ├── testIntelligence/  # intent parse/expand, assertions, test flow
│       │   ├── projectIntelligence/  # Katalon zip/rar index, OR + keyword binding
│       │   ├── projectIntelligenceV2/ # Control + healing + docs (v2 analyze API)
│       │   ├── katalonCompiler/   # deterministic compiler (see README)
│       │   ├── healing/           # self-healing locators + Ollama repair
│       │   ├── groovyLint.ts # lint + web Groovy normalization
│       │   ├── apiCodeGenerator/     # Katalon API generator (Groovy)
│       │   ├── postmanGenerator/     # Postman Collection v2.1 generator
│       │   ├── performanceEngine/    # JMeter + k6 + load strategy from APIs
│       │   ├── apiArchitect/         # Shared semantic intelligence (folders, chaining, scenarios, assertions)
│       │   ├── csvParser.ts
│       │   ├── jira.ts       # REST v3 + runtime credentials; demo if omitted
│       │   ├── playwright.ts # headless extract locators
│       │   ├── playwrightRecorder.ts  # headful record + parsePlaywrightToSteps
│       │   ├── recorderInject.inbrowser.js  # DOM hooks (copied to dist/)
│       │   └── history.ts    # JSON file persistence
│       └── types/
└── client/
    ├── package.json
    ├── vite.config.ts        # dev proxy /api → :8787
    └── src/
        ├── App.tsx           # UI: tabs, generate, project panel, record/mobile
        ├── Onboarding.tsx    # wizard + help dialog
        ├── onboardingContent.ts  # wizard slides, step templates, localStorage key
        ├── FieldTip.tsx      # field-level help (i icons)
        └── api.ts            # fetch helpers (API_BASE from VITE_API_URL)
```

## Prerequisites

- **Node.js** 20+ (for native `fetch`)
- **Playwright Chromium** (for auto-detect locators): after `npm install` in `server/`, run:

  ```bash
  cd server
  npm run playwright:install
  ```

- **Ollama** (default LLM): installed and running (`ollama serve`), with at least one model pulled, e.g.:

  ```bash
  ollama pull llama3.2
  ollama pull codellama
  ```

- **Gemini (optional):** set `GEMINI_API_KEY` in `.env` to enable the Gemini option in the UI; the key stays on the server only.

## Setup

1. Clone or copy this repo and from the repo root:

   ```bash
   npm install
   npm run install:all
   ```

2. Copy environment template (optional):

   ```bash
   copy .env.example .env
   ```

   On Linux/macOS: `cp .env.example .env`

3. Edit environment files as needed:

   **Root / client** (`.env` or Netlify env):

   | Variable | Purpose |
   |----------|---------|
   | `VITE_API_URL` | Backend base URL for the React app (required in production when UI and API are on different hosts). Example: `https://your-api.onrender.com` — no trailing slash. |

   **Server** (`server/.env` or Render env):

   | Variable | Purpose |
   |----------|---------|
   | `PORT` | Backend port (default **8787**) |
   | `ALLOWED_ORIGINS` | Comma-separated CORS origins (e.g. your Netlify URL) |
   | `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Local Ollama |
   | `GEMINI_API_KEY`, `GEMINI_MODEL` | Optional Google Gemini |
   | `GOSI_BRAIN_CHAT_URL`, `GOSI_BRAIN_API_KEY`, `GOSI_BRAIN_MODEL` | Optional Gosi Brain LLM (shown in UI when configured) |
   | `GOSI_BRAIN_AUTHORIZATION_TOKEN` | Optional bearer token for Gosi Brain (or pass via WebView `?token=`) |
   | `KATALON_PROJECT_LOCAL_PATH_ALLOWED` | Set to `1` to allow `POST /api/projects/register-path` on self-hosted installs |

   See `.env.example` for the full list and comments.

4. **Jira (optional):** in the app’s **Jira** tab, enter your site base URL (e.g. `https://your-domain.atlassian.net`), **email**, and **API token** (from [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)), then fetch an issue. Credentials are sent only with that request and are **not** stored in server files or generation history. If all three fields are left empty, the API returns **demo** steps so you can try the flow offline.

## Run (development)

Terminal 1 — backend (default port **8787**):

```bash
cd server
npm run dev
```

Terminal 2 — frontend (default **5173**, proxies `/api` to the backend):

```bash
cd client
npm run dev
```

Or from repo root (requires root `npm install` once for `concurrently`):

```bash
npm install
npm run install:all
npm run dev
```

Open **http://localhost:5173** (or the port Vite prints if 5173 is busy).

## API (backend)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Health + Ollama base URL + default model + **Gemini** / **Gosi Brain** configured flags + default model ids |
| `POST` | `/api/generate` | Body includes `platform`, `steps[]`, optional **`deterministicCompiler`** (default `true` — no LLM; set `false` for legacy Ollama/Gemini), optional `llm`, `model`, `stream`, `mode`, `recordedPlaywrightScript`, `url`, `locators`, `autoDetectLocators`, `pageLocale`, Katalon project XML / imports, optional **`projectId`** + **`projectGenerationMode`** (`strict_reuse` \| `balanced` \| `generate_everything`) to reuse indexed OR/keywords, `testTemplate`, `stylePass`, `commentLanguage`, … → Groovy + **`lint`**. Response may include **`compilerWarnings`**, **`deterministic: true`**, **`projectIntelligence`** (bindings per step). **422** if deterministic output fails validation. **`mode: "record"`** (web only): if `url` is set and `recordedPlaywrightScript` is omitted, runs a **headful** record session on the server, then merges locators; failures fall back to `steps` in the body. With a prior record result, send `recordedPlaywrightScript` and omit `url` to skip re-recording. |
| `POST` | `/api/api-generator/swagger` | Generate **Katalon API Groovy** from Swagger/OpenAPI (`{ spec, projectId?, testCaseName?, includeNegative?, includeBoundary?, aiMemoryMode? }`) |
| `POST` | `/api/api-generator/postman` | Generate **Katalon API Groovy** from a Postman collection (`{ collection, ... }`) |
| `POST` | `/api/api-generator/curl` | Generate **Katalon API Groovy** from cURL (`{ curl, ... }`) |
| `POST` | `/api/api-generator/endpoint` | Generate **Katalon API Groovy** from endpoint JSON (`{ method?, path?, url?, requestJson?, responseJson?, ... }`) |
| `POST` | `/api/postman/generate` | Generate **Postman Collection v2.1** + environments (`{ inputType, swagger/spec, collection, curl, method/path/url, requestJson/responseJson, projectId?, aiMemoryEnabled? }`) |
| `POST` | `/api/performance/generate` | Generate **JMeter + k6 + strategy** (`{ inputType, mode, config: { vus, duration, rampUp, environment?, baseUrl? }, projectId?, useProjectApis?, output? }`) |
| `GET` | `/api/projects` | List indexed Katalon projects (`server/data/projects/`) |
| `POST` | `/api/projects/upload` | Multipart `archive` (.zip or .rar) → parsed index |
| `POST` | `/api/projects/register-path` | `{ folderPath, projectName? }` — self-hosted only; requires `KATALON_PROJECT_LOCAL_PATH_ALLOWED=1` |
| `GET` | `/api/projects/:id` | Full parsed index (OR, keywords, flows, graph) |
| `POST` | `/api/projects/:id/reindex` | Re-scan source |
| `DELETE` | `/api/projects/:id` | Remove cached project |
| `POST` | `/api/projects/:id/match` | Preview semantic matches for `steps[]` |
| `GET` | `/api/projects/:id/search?q=` | Search OR + keywords |
| `POST` | `/api/projects/:id/v2/analyze` | **Project Intelligence v2** — script fixes, OR healing proposals, project graph, insights, Markdown docs |
| `POST` | `/api/projects/:id/v2/fix-script` | Click-to-fix one Groovy script (`{ scriptPath }`) — original vs fixed + issues |
| `POST` | `/api/projects/:id/v2/heal-locator` | Click-to-heal one OR item (`{ orPath, pageUrl? }`) — ranked locators + Katalon/OR snippets |
| `GET` | `/api/projects/:id/v2/graph` | Project control graph (dependencies, orphans, duplicates) |
| `POST` | `/api/record/start` | `{ url }` → `{ ok: true }`. Starts **headed** Chromium on the **host running the backend** (non-blocking). Returns `409` if a session is already running. |
| `POST` | `/api/record/cancel` | Closes the headed browser and clears session state (use after a refresh or if the UI shows “already in progress”). |
| `GET` | `/api/record/status` | `{ active, url }` — poll while recording; `url` updates on navigation and SPA route changes. |
| `GET` | `/api/record/result` | After `active` is false: `{ steps, locators, playwrightScript }`. Returns `404` if there is no result yet, or `500` if the session failed. |
| `POST` | `/api/locators` | `{ url }` → `{ locators: LocatorResult[] }` (Playwright; 400 if URL missing) |
| `POST` | `/api/parse-csv` | `multipart/form-data` field `file` → `{ steps[] }` |
| `POST` | `/api/jira/issue` | `{ issueKey, credentials?: { baseUrl, email, apiToken } }` → `{ key, summary, steps[], mock }`. All three credential fields required together for a live call; otherwise `mock: true` demo data. **400** incomplete credentials; **401** invalid auth; **404** issue not found. |
| `GET` | `/api/history` | Last generations (from `server/data/history.json`) |
| `DELETE` | `/api/history` | Clear history file |
| `POST` | `/api/heal/locator` | Self-healing: JSON body with `url`, `stepId`, `action`, `failedLocator: { type, value }`, optional `domSnapshot`, `maxRetries`, `skipAi` → ranked attempts, optional `suggestedKatalonSnippet`, `memoryUpdated` |
| `GET` | `/api/heal/memory` | Learned locator fixes (`server/data/healing-memory.json`) |
| `POST` | `/api/mobile/session/start` | Start Appium session: `{ appiumUrl, capabilities }` → `{ sessionId, platformName, capabilities }` |
| `POST` | `/api/mobile/locators` | Extract mobile locators from `getPageSource`: `{ appiumUrl, sessionId }` → `{ platform, locators[] }` |
| `POST` | `/api/mobile/session/stop` | Stop Appium session: `{ appiumUrl, sessionId }` |
| `POST` | `/api/mobile/record/start` | Start mobile record proxy: `{ appiumUrl }` → `{ proxyUrl, recordingId }` |
| `POST` | `/api/mobile/record/stop` | Stop recording → `{ steps[], locatorsText, rawCommands[] }` |

### LLM integration

- **Ollama:** `POST {OLLAMA_BASE_URL}/api/generate` with `{ "model", "prompt", "stream": false | true }`.
- **Gemini:** `generateContent` / `streamGenerateContent` (see `server/src/services/gemini.ts`).

Environment:

- `OLLAMA_BASE_URL` — default `http://localhost:11434`
- `OLLAMA_MODEL` — default model name if the client omits it (`llama3.2`)
- `GEMINI_API_KEY` — optional; required when `llm: "gemini"`
- `GEMINI_MODEL` — default Gemini model id if the client omits it (`gemini-2.0-flash`)

## Generation options (high level)

The UI and `/api/generate` support:

- **Platform:** `web` | `mobile` (different prompts and keywords).
- **LLM:** Ollama (local) or Gemini (API key on server).
- **Streaming:** optional live token stream; web scripts are still normalized after the full response is received.
- **Record mode:** live browser recording + Playwright script for the prompt.
- **Auto-detect locators:** Playwright pass over `url` to merge CSS/XPath hints.
- **Katalon project intelligence:** upload `.zip`/`.rar`, pick **Active project** and generation mode (`strict_reuse` | `balanced` | `generate_everything`); reuse OR paths and `CustomKeywords` from indexed sources.
- **Gosi Brain:** optional server-side LLM when `GOSI_BRAIN_*` env vars are set (UI model dropdown).
- **Test templates:** e.g. smoke, regression, data-driven (prompt shaping).
- **Style pass:** e.g. `simplify` formatting.
- **Comments:** English or Arabic for step comments.

## CSV format

Expected header row (case-insensitive):

```csv
Step,Description
1,Open browser
2,Navigate to login page
```

## Example

**Input steps (manual, with project intelligence):**

```text
use keyword common.WebUiHelpers.openToUrl("https://www.example.com/")
click btn_Login
type input_Username admin
type input_Password secret
use keyword safeCloseBrowser()
```

**Locators (textarea):**

```text
btn_Login = Page_Login/btn_Login
input_Username = Page_Login/txt_Username
input_Password = Page_Login/txt_Password
```

**Output (deterministic):** Groovy with `CustomKeywords.'common.WebUiHelpers.openToUrl'(...)`, `findTestObject('Page_Login/...')` when OR labels match the index, `WebUI.setText` / `WebUI.click` for mapped locators, and `CustomKeywords.'common.WebUiHelpers.safeCloseBrowser'()` — without spurious `verifyTextPresent` or extra `openBrowser` when keywords already handle navigation.

**Legacy LLM example** (plain English, no keywords):

```text
Open browser
Navigate to https://example.com
Enter username
Click Login
```

Exact LLM output depends on the model; **web** LLM output is still post-processed for imports and `openBrowser` as described above.

## Production build

**Split hosting (recommended):** static frontend + API backend.

| Host | Build | Config |
|------|-------|--------|
| **Netlify** (frontend) | `npm run build:netlify` → `client/dist` (see `netlify.toml`) | Set `VITE_API_URL` to your backend URL |
| **Render / VPS** (backend) | `cd server && npm run build && npm start` | Set `ALLOWED_ORIGINS` to your Netlify (and custom) domains; copy `server/.env` |

The Vite dev proxy sends `/api` to `localhost:8787`. In production the client calls `VITE_API_URL` directly — no `/api` redirect on Netlify is required.

**Single host (nginx):**

```bash
cd server && npm run build && npm start
cd client && npm run build
```

Serve `client/dist` as static files and reverse-proxy `/api` to the Node server on port `8787` (or set `PORT`). Leave `VITE_API_URL` empty so the UI uses same-origin `/api`.

**Note:** Playwright record/locator routes need a long-lived Node process with Chromium installed — they do not run on Netlify serverless functions. Use Record and auto-detect locators against a self-hosted or Render backend.

## Quality notes

- **Prompt** enforces Web vs Mobile, locator rules, inline `TestObject` vs `findTestObject`, no raw Selenium in intent, and Groovy-oriented output. Models can still drift—**review** generated scripts before production use.
- **Web post-processing** reduces common Studio failures (missing types, bad imports, `openBrowser` overload errors).
- **Lint** surfaces likely issues in non-streaming responses.
- **Errors:** Jira/Ollama/Gemini failures return JSON `{ error }` with HTTP 4xx/5xx.
- **History:** Stored under `server/data/history.json` (gitignored when created).

## License

Use and modify freely for internal tooling.
