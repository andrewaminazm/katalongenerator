# Katalon Script Generator (Katalon Groovy Generator)

Production-oriented web app that converts:

- manual test steps (free-text)
- CSV files
- Jira issues
- Playwright-recorded flows

…into **Katalon Studio Groovy** scripts (WebUI / Mobile keywords).

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

4. Click **Generate** to get Groovy.

Optional features you can enable in the UI:

- **Auto-detect locators**: runs Playwright on a URL and merges results with your locator text.
- **Record mode**: opens a headed browser *on the machine running the server*, records actions, and converts them into steps/locators.
- **Convert to Katalon Locators**: converts Selenium/Cypress/Playwright locator styles into Katalon-friendly CSS/XPath.

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
  → Step parser → action compiler (WebUI / Mobile keywords only)
  → Locator lines → score & pick one strategy per label → TestObject builder
  → Script assembler (fixed order: imports → setup → TestObjects → actions → cleanup)
  → autoFix (web: normalizeKatalonWebGroovy) → validation gatekeeper → Groovy + lint + compilerWarnings
```

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
│       │   ├── katalonCompiler/   # deterministic compiler (see README)
│       │   ├── healing/           # self-healing locators + Ollama repair
│       │   ├── groovyLint.ts # lint + web Groovy normalization
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
        ├── App.tsx           # UI: inputs, platform, LLM choice, output, history
        └── api.ts            # fetch helpers
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

3. Edit `.env` as needed:
   - `OLLAMA_BASE_URL`, `OLLAMA_MODEL` — local Ollama
   - `GEMINI_API_KEY`, `GEMINI_MODEL` — optional cloud LLM
   - `PORT` — backend port (default **8787**)

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
| `GET` | `/api/health` | Health + Ollama base URL + default model + **Gemini configured** flag + default Gemini model |
| `POST` | `/api/generate` | Body includes `platform`, `steps[]`, optional **`deterministicCompiler`** (default `true` — no LLM; set `false` for legacy Ollama/Gemini), optional `llm`, `model`, `stream`, `mode`, `recordedPlaywrightScript`, `url`, `locators`, `autoDetectLocators`, `pageLocale`, Katalon project XML / imports, `testTemplate`, `stylePass`, `commentLanguage`, … → Groovy + **`lint`**. Response may include **`compilerWarnings`**, **`deterministic: true`**. **422** if deterministic output fails validation. **`mode: "record"`** (web only): if `url` is set and `recordedPlaywrightScript` is omitted, runs a **headful** record session on the server, then merges locators; failures fall back to `steps` in the body. With a prior record result, send `recordedPlaywrightScript` and omit `url` to skip re-recording. |
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
- **Katalon project context:** optional XML / uploaded OR paths to align `findTestObject` and style.
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

**Input steps (manual):**

1. Open browser  
2. Navigate to `https://example.com`  
3. Enter username  
4. Click Login  

**Locators (textarea):**

```text
Login Button = Page_Login/btn_Login
Username Field = Page_Login/txt_Username
```

**Output:** Groovy using `WebUI.*` and, when the map uses OR paths, `findTestObject('Page_Login/...')`. For CSS/XPath lines, the prompt favors inline `TestObject` + `addProperty`. Exact code depends on the model; **web** output is post-processed for imports and `openBrowser` as described above.

## Production build

```bash
cd server && npm run build && npm start
cd client && npm run build
```

Serve `client/dist` as static files behind nginx (or similar) and reverse-proxy `/api` to the Node server on port `8787` (or set `PORT`).

## Quality notes

- **Prompt** enforces Web vs Mobile, locator rules, inline `TestObject` vs `findTestObject`, no raw Selenium in intent, and Groovy-oriented output. Models can still drift—**review** generated scripts before production use.
- **Web post-processing** reduces common Studio failures (missing types, bad imports, `openBrowser` overload errors).
- **Lint** surfaces likely issues in non-streaming responses.
- **Errors:** Jira/Ollama/Gemini failures return JSON `{ error }` with HTTP 4xx/5xx.
- **History:** Stored under `server/data/history.json` (gitignored when created).

## License

Use and modify freely for internal tooling.
