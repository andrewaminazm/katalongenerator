# Katalon Script Generator (Ollama)

Production-oriented web tool that turns manual test steps, CSV files, Jira issues, or **Playwright-recorded flows** into **Katalon Studio Groovy** scripts using a **local Ollama** model. No OpenAI or cloud LLM APIs—after setup, generation runs fully offline except optional Jira calls.

## Architecture

| Layer | Stack |
|--------|--------|
| Frontend | React 18 + Vite + TypeScript |
| Backend | Node.js 20+ + Express + TypeScript |
| Locators / record | Playwright (Chromium): `/api/locators`, headful record (`/api/record/start` + poll status/result), and generate `mode: "record"` |
| AI | Ollama `POST /api/generate` (default `http://localhost:11434`) |

### Data flow

```
User input (manual / CSV / Jira / Record)
  → Optional Playwright crawl (`autoDetectLocators` + `url`) → merge with manual locators
  → Optional headful record (`/api/record/start` + status/result, or generate `mode: "record"` + `url`) → steps + locators + script in prompt
  → Normalize steps (backend)
  → Prompt builder (Katalon WebUI vs Mobile, locator rules, recorded Playwright block when present)
  → Ollama generate
  → Groovy text → UI + optional server-side history
```

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
│       ├── routes/api.ts     # REST: generate, record, locators, CSV, Jira, history
│       ├── services/
│       │   ├── ollama.ts     # HTTP client for Ollama (stream + non-stream)
│       │   ├── promptBuilder.ts
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
        ├── App.tsx           # UI: inputs, platform, output, history
        └── api.ts            # fetch helpers
```

## Prerequisites

- **Node.js** 20+ (for native `fetch`)
- **Playwright Chromium** (for auto-detect locators): after `npm install` in `server/`, run:

  ```bash
  cd server
  npm run playwright:install
  ```

- **Ollama** installed and running (`ollama serve`), with at least one model pulled, e.g.:

  ```bash
  ollama pull llama3.2
  ollama pull codellama
  ```

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

3. **Jira (optional):** in the app’s **Jira** tab, enter your site base URL (e.g. `https://your-domain.atlassian.net`), **email**, and **API token** (from [Atlassian API tokens](https://id.atlassian.com/manage-profile/security/api-tokens)), then fetch an issue. Credentials are sent only with that request and are **not** stored in server files or generation history. If all three fields are left empty, the API returns **demo** steps so you can try the flow offline.

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

Open **http://localhost:5173**.

## API (backend)

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/health` | Health + Ollama base URL + default model |
| `POST` | `/api/generate` | Body includes `platform`, `steps[]`, optional `mode: "record"`, `recordedPlaywrightScript`, `url`, `locators`, `autoDetectLocators`, … → Groovy. **`mode: "record"`** (web only): if `url` is set and `recordedPlaywrightScript` is omitted, runs a **headful** record session on the server, then merges locators; failures fall back to `steps` in the body. With a prior record result, send `recordedPlaywrightScript` and omit `url` to skip re-recording. |
| `POST` | `/api/record/start` | `{ url }` → `{ ok: true }`. Starts **headed** Chromium on the **host running the backend** (non-blocking). Returns `409` if a session is already running. |
| `POST` | `/api/record/cancel` | Closes the headed browser and clears session state (use after a refresh or if the UI shows “already in progress”). |
| `GET` | `/api/record/status` | `{ active, url }` — poll while recording; `url` updates on navigation and SPA route changes. |
| `GET` | `/api/record/result` | After `active` is false: `{ steps, locators, playwrightScript }`. Returns `404` if there is no result yet, or `500` if the session failed. |
| `POST` | `/api/locators` | `{ url }` → `{ locators: LocatorResult[] }` (Playwright; 400 if URL missing) |
| `POST` | `/api/parse-csv` | `multipart/form-data` field `file` → `{ steps[] }` |
| `POST` | `/api/jira/issue` | `{ issueKey, credentials?: { baseUrl, email, apiToken } }` → `{ key, summary, steps[], mock }`. All three credential fields required together for a live call; otherwise `mock: true` demo data. **400** incomplete credentials; **401** invalid auth; **404** issue not found. |
| `GET` | `/api/history` | Last generations (from `server/data/history.json`) |
| `DELETE` | `/api/history` | Clear history file |

### Ollama integration

- Non-stream: `POST {OLLAMA_BASE_URL}/api/generate` with `{ "model", "prompt", "stream": false }`.
- Stream (optional UI): same endpoint with `"stream": true`; backend forwards token chunks as `text/plain`.

Environment:

- `OLLAMA_BASE_URL` — default `http://localhost:11434`
- `OLLAMA_MODEL` — default model name if the client omits it (`llama3.2`)

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

**Output:** Groovy using `WebUI.*` and `findTestObject('Page_Login/...')` per prompt rules (exact code depends on the local model).

## Production build

```bash
cd server && npm run build && npm start
cd client && npm run build
```

Serve `client/dist` as static files behind nginx (or similar) and reverse-proxy `/api` to the Node server on port `8787` (or set `PORT`).

## Quality notes

- **Prompt** enforces WebUI vs Mobile, `findTestObject`, no Selenium, Groovy 3, and skipping steps without locators (LLM may still drift—review generated scripts).
- **Errors:** Jira/Ollama failures return JSON `{ error }` with HTTP 4xx/5xx.
- **History:** Stored under `server/data/history.json` (gitignored when created).

## License

Use and modify freely for internal tooling.
# katalongenerator
