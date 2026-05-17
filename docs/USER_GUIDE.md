# Katalon Script Generator — How to use

This guide is for **end users**. It explains how to enter test steps on each tab, how to add locators (by hand or by fetching them), and how to **generate Katalon Groovy** code.

---

## Before you start

1. Make sure the green status shows **Gosi Brain: ready** (top right). If you see **API unreachable**, contact your administrator — the app cannot reach the server.
2. Choose **Platform**: **Web (WebUI)** for websites, **Mobile** for apps via Appium (see “Mobile” at the end).

Your workflow is always:

1. **Get test steps** (Manual, CSV, Jira, or Record tab).
2. **Add locators** — type them yourself **and/or** fetch them from a page URL **and/or** use recording (Record tab fills locators automatically).
3. Scroll down and click **Generate Katalon Groovy**. The script appears in the panel on the right.

---

## The four tabs (where your steps come from)

Use **one tab at a time** as the source of steps when you generate.

### Manual

1. Open the **Manual** tab.
2. In **Test steps (one per line)**, type each step on its own line, for example:

```text
Open https://example.com/login
Click Login
Type username into Username field
```

3. Adjust locators below (see **Locators — three ways**), then click **Generate Katalon Groovy**.

**Tip:** Write steps clearly (what to click, type, or open). One idea per line works best.

---

### CSV

1. Open the **CSV** tab.
2. Choose your `.csv` file.
3. **Simple files:** rows become steps automatically (columns like Step / Description).
4. **Test-case exports:** you see a table of test cases — tick the rows you want, then **Select all** / **Clear all** as needed. Only checked rows supply steps.
5. Stay on **CSV**, set locators if needed, then **Generate Katalon Groovy**.

---

### Jira

1. Open the **Jira** tab.
2. Fill **Jira base URL**, **Email or username**, and **Password / PAT / API token** (your administrator will tell you what to use).
3. Enter the **Issue key** (for example `PROJ-123`) or paste the browse URL.
4. Click **Fetch from Jira**. Steps appear in **Test steps from Jira** — you can edit them.
5. Stay on **Jira**, add locators if needed, then **Generate Katalon Groovy**.

If you leave credentials empty, only **demo** sample steps load (for practice).

---

### Record (Web only)

Recording is **only for Web**. It opens a **real browser window on the server** — complete your actions there, then finish recording.

1. Open the **Record** tab (switch **Platform** to **Web** if Record is greyed out).
2. Enter the **URL to open**.
3. Click **Record test flow**. Use the Chromium window that opens; use **Finish recording** when done (or wait for timeout).
4. The tool fills the **Playwright-style script** area and **merges locator lines** into the main **Locators** box below.
5. Scroll down, review locators, then **Generate Katalon Groovy**.

**Alternatives:** You can paste a Playwright script instead of recording. **Lossless replay** keeps the recording closer to what you did (fewer automatic changes).

If recording gets stuck, use **Cancel recording on server**.

---

## Locators — three ways (manual, preview, auto-detect)

Locators tell the generator **which element** each step refers to. They live in the big **Locators** box (same area on every tab).

### Option A — Enter locators manually

Type **one mapping per line**:

```text
Login button = #btn-login
Username field = input#username
Password field = //input[@type='password']
```

Left side = **short name** you can mention in steps. Right side = **CSS selector** or **XPath**.

Manual lines are **never overwritten**: if the tool also finds locators from the page, **your manual lines win** when labels match.

---

### Option B — Preview locators from a URL (reference only)

Use this to **see** suggested Playwright-style lines without replacing your Locators box yet.

1. Fill **Page URL (preview & auto-detect for generate)** with the **https://** address of the page.
2. Set **Page language** to **Auto**, **English**, or **Arabic** if the site uses Arabic UI text.
3. Click **Preview locators from URL**.
4. Read the **Playwright locators preview** panel. To reuse lines, copy what you need into **Locators** and edit labels if you want (`My label = …`).

*(Your organisation must run the feature on a server that supports browser automation.)*

---

### Option C — Auto-detect during Generate

1. Fill **Page URL** as above.
2. Turn on **Auto-detect for generate** (checkbox).
3. When you click **Generate Katalon Groovy**, the server visits the page and **adds** locator candidates that fit your steps. Your **manual Locators lines still take priority** where both exist.

---

### Recording fills Locators for you

After **Record test flow**, **`name = selector`** lines are **merged into Locators**. You can edit that box before generating.

---

### Convert Playwright-style lines to Katalon format

If your Locators box contains Playwright/Selenium/Cypress style lines:

1. Optionally turn on **Auto convert before generate** so conversion happens automatically when you generate.
2. Or click **Convert to Katalon Locators** first to see a table of results, then generate.

---

## Generate Katalon Groovy

When your **steps** are ready from the active tab **and** your **locators** situation is clear:

1. Scroll to **Generate Katalon Groovy** (green button).
2. Optional: enable **Stream response (live typing)** to watch the script appear gradually.
3. Click **Generate Katalon Groovy**.

Wait until generation finishes. Errors appear in red above the button — read the message and fix steps or locators, then try again.

**Optional fields you can set before generating:**

- **Gosi Brain model** — leave default unless instructed otherwise.
- **Test case name** — optional name for export/download.
- **Format / style pass** — optional cleanup of the generated script layout.

---

## After generation (right-hand panel)

- **Copy** — copy Groovy to the clipboard.
- **Download .groovy** — save the file.
- **Add to Katalon Project** — needs **Katalon project path** filled with your **local** Katalon project folder (must contain **Test Cases**).
- **Clear** — clears the output area.

You may see **lint** hints below the script — fix serious errors in Katalon if needed.

---

## Mobile testing (short overview)

When **Platform** is **Mobile**:

- Start **Appium** on your machine (often `http://127.0.0.1:4723`).
- Paste **Capabilities (JSON)** for your device/emulator.
- **Start session**, then **Extract locators** to fill suggestions into **Locators**.
- Enter mobile **steps** on **Manual** (or use recording flows your administrator documented).
- **Generate Katalon Groovy** as usual.

The **Record** tab is hidden for Mobile — Web recording does not apply.

---

## History

If **History** appears at the bottom, click an older run to reload its steps and script into the workspace.
