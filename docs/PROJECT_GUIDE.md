# Project Guide — Katalon Script Generator

This document explains what the project is, how it works, how to run it, and how to use the UI to generate Katalon Groovy scripts.

## What this project does

This app converts human-friendly test descriptions into **Katalon Studio Groovy** scripts:

- manual steps (free-text, one per line)
- CSV test steps
- Jira issues (extract steps from the issue)
- Playwright recordings (record in a browser and compile)

The generated Groovy focuses on:

- **Web**: `WebUI.*` keywords + `TestObject` creation
- **Mobile**: `Mobile.*` keywords (where applicable)

## Two generation paths

### 1) Deterministic compiler (default)

This is the recommended path. It does **not** require an LLM to compile steps into Groovy.

High-level flow:

1. Parse steps into intents (click / type / verify / navigation / pressEnter…)
2. Resolve locator hints to locator lines (`Label = selector`)
3. Compile into ordered operations
4. Assemble Groovy in a strict, readable structure
5. Validate and lint the final output

Important behavior:

- The compiler inserts **waits** before interactions.
- If a step cannot be matched to a locator label, it uses a **safe fallback XPath**:
  - Example fallback for `click Settings`:
    - `//*[contains(normalize-space(.),'Settings')]`
- The matcher avoids “silent wrong matches” (e.g., `Settings` should never click `Google Search` just because only one locator exists).

### 2) Legacy LLM path (optional)

When `deterministicCompiler: false`, the backend builds a prompt and calls:

- **Ollama** (local, default), or
- **Gemini** (when `GEMINI_API_KEY` is configured)

Then it runs the same post-processing and linting steps to reduce Katalon Studio failures.

## UI overview

The UI is a single-page app where you:

- paste steps (one per line)
- optionally paste locators (`Label = selector`)
- choose platform + LLM provider (if using LLM mode)
- generate Groovy

![UI screenshot](../assets/c__Users_Admin_AppData_Roaming_Cursor_User_workspaceStorage_1261c6d5313f7081241cf4879a8bfa92_images_image-ac9fd671-c292-4c76-bd00-1f23ccff77a0.png)

## Step format

Steps are free-text. The project includes “Test Intelligence” normalization and intent parsing.

Examples:

```text
1-visit https://www.google.com/
2-click Settings
3-type "hello" in search
4-press enter
```

Guidelines:

- Put **one action per line**
- Prefer quoted text when typing values:
  - `type "john" in username`

## Locator format

Locators are entered as lines:

```text
Settings = //button[contains(normalize-space(.),'Settings') or contains(@aria-label,'Settings')]
Search Input = input[name='q']
```

Supported selector types:

- OR paths (Katalon Object Repository paths)
- CSS
- XPath
- `name=...`
- accessibility id (mobile)

### Converting locators from other tools

The project includes a conversion API that can transform locators from:

- Playwright (`page.getByRole(...)`, `page.locator(...)`, etc.)
- Selenium (common styles)
- Cypress (`cy.get(...)` patterns)

…into CSS/XPath that Katalon’s `TestObject.addProperty` can use.

## Running locally (development)

### Prerequisites

- Node.js 20+
- Optional: Ollama for LLM mode (`ollama serve`)
- Optional: Playwright browsers for auto-detect locators / record mode

### Install

From repo root:

```bash
npm install
npm run install:all
```

### Run

From repo root:

```bash
npm run dev
```

Default URLs:

- Frontend: `http://localhost:5173/`
- Backend: `http://localhost:8787`

### Playwright browsers (optional)

```bash
cd server
npm run playwright:install
```

## Backend API (high level)

Key endpoints:

- `GET /api/health`
- `POST /api/generate`
- `POST /api/locators`
- Record mode:
  - `POST /api/record/start`
  - `GET /api/record/status`
  - `GET /api/record/result`
  - `POST /api/record/cancel`
- Inputs:
  - `POST /api/parse-csv`
  - `POST /api/jira/issue`

## Repo structure (mental model)

- `client/`: React + Vite UI
- `server/`: Express backend + deterministic compiler
  - `server/src/services/katalonCompiler/`: deterministic compiler pipeline
  - `server/src/services/testIntelligence/`: intent parsing + expansion
  - `server/src/services/testDsl/`: step normalization/validation pipeline

## Troubleshooting

### Port already in use

- Backend uses `8787`
- Frontend uses `5173` (Vite will auto-pick another port if busy)

### Ollama errors

Make sure this URL works on the machine running the backend:

- `http://127.0.0.1:11434`

### Record mode opens browser on the server machine

Record mode is **headed** and runs where the backend is running. If the backend is on a remote server, you’ll see the browser there (not on your laptop).

## Security / config notes

- `.env` is gitignored; use `.env.example` as a template.
- Jira credentials are sent with the request and are not stored in generation history.

