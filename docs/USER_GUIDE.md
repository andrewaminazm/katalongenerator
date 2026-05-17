# Katalon Script Generator — User Guide

This guide explains how to use the web application for every input tab and the shared options below them.

---

## 1. What the application does

The tool converts human-readable **test steps** (and optional **locators**) into **Katalon Studio Groovy** scripts for WebUI or Mobile keywords. Generation uses **Gosi Brain** on the server.

---

## 2. Running locally vs production

### Local development

- Start **backend**: `npm run dev` in `server/` (default port **8787**).
- Start **frontend**: `npm run dev` in `client/` (default port **5173**).
- Open `http://localhost:5173`. API calls use the Vite proxy to the backend.

### Production (example layout)

- **Frontend** may be hosted on Netlify (static site).
- **Backend** should run on a full Node host such as **Render** where **Playwright** can launch Chromium (locator extraction and browser recording).

Configure the frontend build with **`VITE_API_URL`** pointing at your backend URL (no trailing slash). On the backend, set **`ALLOWED_ORIGINS`** to your Netlify URL(s) for CORS.

---

## 3. Header status

- **Gosi Brain: ready** — backend is reachable and chat URL + API key are configured.
- **API unreachable** — frontend cannot reach `/api/health` (wrong `VITE_API_URL`, backend down, or network).
- **Gosi Brain: set … env vars** — backend runs but server-side credentials are missing.

### Optional bearer token

If your organisation passes a JWT via WebView, open the app once with **`?token=your_token`** (or full `Bearer …`). It is saved in the browser and sent with generate requests. If empty, the server may use **`GOSI_BRAIN_AUTHORIZATION_TOKEN`** from environment variables instead.

---

## 4. Tabs overview

| Tab | Purpose |
|-----|---------|
| **Manual** | Type or paste steps yourself. |
| **CSV** | Import steps from a CSV file (simple rows or multi test-case export). |
| **Jira** | Fetch steps from a Jira issue description (optional credentials). |
| **Record** | Capture a Web flow in a real Chromium window on the **backend machine**; produces a Playwright-style script and locator lines. |

**Note:** **Record** is disabled when **Platform** is **Mobile** — recording uses Web-only Playwright.

---

## 5. Shared fields (below every tab)

These apply whichever tab is selected.

### Platform

- **Web (WebUI)** — Standard browser automation keywords.
- **Mobile (Mobile)** — Requires **Appium** running locally (see section 10).

### Gosi Brain model

Choose the model exposed by your server configuration (default is shown in the dropdown).

### Test case name (optional)

Used when naming or exporting the generated test case. Leave blank if you do not need a fixed name.

### Katalon project path (for export)

Absolute path to your **Katalon Studio project folder** on **your PC** (must contain a **`Test Cases`** directory). Used by **Add to Katalon Project** — this writes files **locally**, not on the server.

### Format / style pass

- **None** — Minimal post-processing.
- **Simplify layout** — Cleans up formatting after generation.
- **Match project style** — Adjusts wording/layout toward your project context.

### Locators

One line per mapping, for example:

```text
Login button = #submit-login
Username field = input[name='user']
```

Names can align with steps so the compiler resolves targets. Manual lines **take priority** when merged with auto-detected lines.

### Auto convert before generate

When enabled, Playwright/Selenium/Cypress-style locator lines are converted to **Katalon CSS/XPath** before generation.

Use **Convert to Katalon Locators** to preview the conversion table without generating yet.

### Page URL (preview & auto-detect for generate)

HTTPS URL of the page under test. Used by:

- **Preview locators from URL** — fills the read-only Playwright-style preview panel.
- **Auto-detect for generate** — server visits the URL and merges detected locator candidates into generation (manual locators still win on conflicts).

### Page language (Playwright extraction)

**Auto**, **English**, or **Arabic** — influences browser locale when extracting locators from the Page URL.

### Auto-detect for generate

When checked (and Page URL is filled), the backend pulls locator candidates from the live page during **Generate**. Requires a backend with working **Playwright + Chromium** (set **`PLAYWRIGHT_BROWSERS_PATH`** on hosts like Render so browsers persist after build).

### Stream response (live typing)

Streams tokens into the Groovy panel during generation instead of waiting for one response.

---

## 6. Manual tab

1. Enter **test steps**, **one per line**.
2. Optionally fill **Locators**, **Page URL**, enable **Auto-detect**, etc.
3. Click **Generate Katalon Groovy**.

**Tip:** Clear step-specific wording (“Click Login”, “Type password”) helps the compiler.

---

## 7. CSV tab

### Upload

Choose a `.csv` file. The parser detects two shapes:

### Simple format

Columns similar to **`Step`** and **`Description`** — each row becomes step text used for generation.

### Test-case export format

Multiple test cases with a **`Steps`** column (for example Zephyr/VIC-style exports). Expected-result suffixes such as **`| Expected: …`** are stripped.

After load:

- Use **Select all** / **Clear all** and row checkboxes to choose which test cases contribute steps.
- The status line shows how many steps will be sent to **Generate**.

### Generate

Stay on CSV after selection and click **Generate Katalon Groovy** — steps come from selected rows.

---

## 8. Jira tab

### Credentials (optional)

- **Jira base URL** — Site root only, e.g. `https://your-domain.atlassian.net` or `https://jira.company.com`.
- **Email or username** — Atlassian Cloud uses email; Server/Data Center may use username.
- **Password, PAT, or API token** — Same combination you would use for Basic auth or PAT-only REST where configured.

Leave all three empty to load **demo** steps only (nothing is stored on the server).

### Buttons

- **Test Jira login** — Calls **`GET /myself`** to verify URL and credentials without loading an issue.
- **Fetch from Jira** — Loads the issue and parses steps into the **Test steps from Jira** box.

### Editing steps

Edit the textarea if needed — **Generate** uses exactly these lines while you remain on the **Jira** tab.

### Troubleshooting

- **401** — Wrong URL, user, or secret.
- **403** — Often blocked Basic auth or missing REST permission; try a **PAT** or ask your Jira admin.

---

## 9. Record tab (Web only)

Recording opens **Chromium on the machine running the backend**, not inside your laptop browser alone.

1. Enter **URL to open**.
2. Click **Record test flow** — interact with the browser window; finish via **Finish recording** on the page or wait for timeout.
3. The **Playwright-style script** textarea fills; locator **`name = selector`** lines merge into **Locators**.
4. Adjust locators if needed, then **Generate Katalon Groovy**.

### Lossless replay

Check **Lossless replay** to minimise rewriting (preserve trace fidelity; skips some Groovy optimisers).

### Stuck session

Use **Cancel recording on server** if you closed the browser or refreshed the UI while a session was active.

### Paste-only workflow

You may paste an existing Playwright script instead of recording — still fill **URL** when the server needs it for locator extraction.

---

## 10. Mobile (Appium) panel

Shown when **Platform** is **Mobile**.

1. Start **Appium** locally (default `http://127.0.0.1:4723`).
2. Paste **Capabilities** as JSON matching your device/emulator.
3. **Check Appium** — Verifies connectivity.
4. **Start session** — Opens an Appium session.
5. **Extract locators** — Reads page source and fills locator suggestions into **Locators**.
6. **Stop session** — Ends the session.

### Mobile recording proxy

**Start Recording** / **Stop Recording** uses a proxy URL shown in the hint — use it **only** in Appium Inspector or another client as directed; **do not** replace the main Appium URL field used for extract/stop.

**Apply to Steps+Locators** moves captured commands into Manual-oriented steps when recording stopped.

---

## 11. Output panel

- **Clear** — Clears generated Groovy text.
- **Copy** — Copies script to clipboard.
- **Add to Katalon Project** — Writes under **Test Cases** using **Katalon project path** (local disk).
- **Download .groovy** — Downloads the script file.

Lint warnings may appear below when the server validates Groovy.

---

## 12. History

Past generations may appear in **History** — click an entry to reload steps and script into the workspace.

---

## 13. Quick checklist before Generate

- Backend reachable (**Gosi Brain: ready**).
- Valid bearer token if your deployment requires it (or server env fallback configured).
- Steps present **or** Record tab has script/URL as required.
- Locators filled or **Auto-detect** + **Page URL** if you rely on automatic mapping.
- **Playwright features** only work where Chromium is installed on the backend (`npx playwright install chromium` during deploy and persistent browser path if applicable).

---

## 14. Support commands (maintainers)

From repository root:

```bash
npm run docs:user-pdf
```

Rebuilds **`docs/USER_GUIDE.pdf`** from this Markdown file (requires Playwright/Chromium locally).
