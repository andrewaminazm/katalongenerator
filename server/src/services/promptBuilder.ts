import type {
  CommentLanguage,
  KatalonProjectContext,
  Platform,
  StylePass,
  TestTemplate,
} from "../types/index.js";
import {
  extractArabicSequences,
  filterAutoLinesNotOverriddenByUser,
  mergeLocatorTexts,
} from "./playwright.js";
import { selectOrPathsForPrompt } from "./orMatcher.js";

export interface PromptExtraOptions {
  testTemplate?: TestTemplate;
  executionProfile?: string;
  globalVariablesNote?: string;
  commentLanguage?: CommentLanguage;
  stylePass?: StylePass;
  /** Heuristic step → OR lines from server-side matcher */
  orSuggestionsText?: string;
}

function buildGenerationProfileBlock(
  opts: PromptExtraOptions,
  hasProjectContext: boolean
): string {
  const t: TestTemplate = opts.testTemplate ?? "default";
  const templateText: Record<TestTemplate, string> = {
    default: "Balanced script — keep scope strictly to the listed TEST STEPS.",
    smoke: "SMOKE: minimal branching, happy-path unless a step explicitly requires a negative case; fewest WebUI calls.",
    regression:
      "REGRESSION: where steps mention verify/check/expect, add appropriate WebUI.verify* / wait*; do not invent checks not implied by steps.",
    "api-mix":
      "API-MIX: if steps mention API/HTTP/REST, prefer WS.* or listed Custom Keywords for API; WebUI only when the step clearly needs the browser.",
    "data-driven":
      "DATA-DRIVEN: when steps mention data sets, CSV, rows, or parameters, use Groovy variables / loops — do not invent external file paths.",
  };

  const lang: Record<CommentLanguage, string> = {
    en: "Write // Step: and // Purpose: comments in English.",
    ar: "اكتب تعليقات // Step: و // Purpose: بالعربية (أبقِ أسماء الكود والـ APIs بالإنجليزية).",
  };
  const commentLanguage: CommentLanguage = opts.commentLanguage === "ar" ? "ar" : "en";

  const stylePass: StylePass = opts.stylePass ?? "none";
  const styleLine =
    stylePass === "simplify"
      ? "STYLE: prefer concise layout; remove redundant waits and duplicate logic."
      : stylePass === "match-project" && hasProjectContext
        ? "STYLE: align naming and abstraction with the imported project (OR lists + XML)."
        : stylePass === "match-project"
          ? "STYLE: conventional readable Groovy (limited project style context)."
          : "";

  const lines = [
    "=== GENERATION PROFILE ===",
    `Test template: ${t} — ${templateText[t]}`,
  ];
  if (opts.executionProfile?.trim()) {
    lines.push(`Execution profile (informational): ${opts.executionProfile.trim()}`);
  }
  if (opts.globalVariablesNote?.trim()) {
    lines.push(
      `Global variables / profile: ${opts.globalVariablesNote.trim()} — use GlobalVariable.* only when consistent with project; never invent secrets.`
    );
  }
  lines.push(lang[commentLanguage]);
  if (styleLine) lines.push(styleLine);
  lines.push("=== END GENERATION PROFILE ===\n");
  return lines.join("\n");
}

function bulletList(title: string, items: string[] | undefined): string {
  if (!items?.length) return `${title}\n(none listed)\n`;
  const lines = items.map((s) => `- ${s}`).join("\n");
  return `${title}\n${lines}\n`;
}

/** True if merged locator text contains RHS values that are CSS or XPath (from Playwright auto-detect). */
function buildStepArabicLocatorBindingBlock(
  steps: string[],
  mergedLocatorsText: string
): string {
  const t = mergedLocatorsText.trim();
  if (!t || t.startsWith("(No locators")) return "";
  const locatorLines = t
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.includes("=") && !l.startsWith("("));
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const step of steps) {
    for (const ar of extractArabicSequences(step)) {
      if (ar.length < 2) continue;
      for (const locLine of locatorLines) {
        const eq = locLine.indexOf("=");
        if (eq === -1) continue;
        const rhs = locLine.slice(eq + 1).trim();
        if (!rhs.includes(ar)) continue;
        const key = `${ar}::${locLine}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(
          `- If the step mentions “${ar}” → use this **entire** locator line verbatim (copy the full value after = into addProperty; do not translate): ${locLine}`
        );
        break;
      }
    }
  }
  if (!lines.length) return "";
  return `
=== ARABIC / RTL — STEP ↔ LOCATOR BINDINGS (MANDATORY) ===
${lines.join("\n")}

Hard rules:
- The selector after **=** must appear **character-for-character** in your Groovy (including Arabic inside \`normalize-space()\` or other quotes). Never substitute French/English/Spanish words (e.g. “presidente”, “président”) or random #ids when the map already has an Arabic xpath/css.
- Implement with **\`TestObject\` + \`addProperty('xpath'|'css', …)\`** using that selector — **never** \`findTestObject('ArabicLabel')\` for the Arabic text from the step or the label before \`=\`.
- TestObject’s object id string (first arg to \`new TestObject\`) may be ASCII; **xpath/css property values must match the map exactly**.
=== END ARABIC BINDINGS ===
`;
}

function mergedMapHasPlaywrightSelectors(mergedLocatorsText: string): boolean {
  for (const line of mergedLocatorsText.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("(")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const rhs = t.slice(eq + 1).trim();
    if (
      rhs.startsWith("xpath=") ||
      rhs.startsWith("//") ||
      rhs.startsWith("#") ||
      rhs.startsWith(".") ||
      rhs.startsWith("[") ||
      /^[a-zA-Z][\w-]*(\s|#|\.|\[)/.test(rhs)
    ) {
      return true;
    }
  }
  return false;
}

function buildProductionScriptContract(platform: Platform): string {
  if (platform === "web") {
    return `
========================
PRODUCTION SCRIPT CONTRACT (MUST FOLLOW — WEB)
========================
You are a senior automation engineer for **Katalon Studio (Groovy)** using **Selenium-backed WebUI**. Generate a **COMPLETE, EXECUTABLE** test script that runs **copy → paste → run** in Katalon Studio **without modification**.

STRICT TECHNICAL RULES:
- Valid **Groovy** only. Use **ONLY** Katalon built-ins: **WebUI**, **TestObject**, **ConditionType**, and **findTestObject** (per imports below). No raw Selenium WebDriver APIs, no invented helpers.
- **FORBIDDEN IMPORTS:** Never \`import org.openqa.selenium.WebDriver\`, never \`WebDriver.LocationType\`, \`FRAMENAME\`, or any \`import static org.openqa.selenium.WebDriver.*\` — these types are not valid for Katalon scripts and **fail compilation**. Iframe handling (if ever needed) must use Katalon WebUI keywords only, not Selenium WebDriver inner enums.

========================
MANDATORY IMPORTS (ALWAYS at the very top of the script, in this **exact** order)
========================
import com.kms.katalon.core.model.FailureHandling
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.testobject.TestObject
import com.kms.katalon.core.testobject.ConditionType
import org.openqa.selenium.Keys

Add \`import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject\` **only** on the line **after ConditionType** (before Keys) when the script calls \`findTestObject('ObjectRepository/path')\`; omit that line when you use only inline \`new TestObject(...)\` + \`addProperty\`.

Groovy overload note: **always** call \`WebUI.openBrowser(urlOrEmptyString, FailureHandling.STOP_ON_FAILURE)\` — never a one-argument \`openBrowser(...)\` (Katalon can throw MethodSelectionException). Prefer a \`String pageUrl = 'https://...'\` variable then \`WebUI.openBrowser(pageUrl, FailureHandling.STOP_ON_FAILURE)\` when the URL is reused or keeps the script readable.

========================
TEST STRUCTURE (STRICT — Web)
========================
1. Optionally \`String pageUrl = 'https://...'\` then \`WebUI.openBrowser(pageUrl, FailureHandling.STOP_ON_FAILURE)\` (or \`''\` as first arg when steps imply default browser URL)
2. WebUI.maximizeWindow()
3. WebUI.navigateToUrl('...') with the URL from TEST STEPS / EFFECTIVE map when it differs from what openBrowser already opened
4. Wait for page ready (e.g. WebUI.waitForPageLoad(30) if appropriate for your Studio version, or a short wait then proceed)
5. For each UI step: build/use TestObject → wait → action → optional verify (see below)
6. Add verification where TEST STEPS imply it (WebUI.verifyElementPresent, verifyTextPresent, verifyMatch on URL, etc.)
7. WebUI.closeBrowser() as final cleanup when the flow ends

========================
TEST OBJECT CREATION — PASTE-READY (NO PRE-BUILT OBJECT REPOSITORY)
========================
The user pastes this script into a **new** Katalon test case. **findTestObject('…') only works if that object already exists** in the project Object Repository. So:

- **DEFAULT (mandatory when RHS is a selector):** For every EFFECTIVE / REAL / USER map line whose **right-hand side** is **CSS or XPath** (starts with #, ., [, tag…, \`xpath=\`, or //), you **MUST** define the locator **inside the script** with \`new TestObject(...)\` + \`addProperty\`. **Never** call \`findTestObject\` with the **left-hand label** (Arabic or English) — that label is **not** an OR path and will **fail** after paste.

- **CSS or XPath** (copy RHS verbatim; strip only a leading \`xpath=\` when using addProperty('xpath', …)):
  TestObject toAbout = new TestObject('aboutLink')
  toAbout.addProperty('xpath', ConditionType.EQUALS, '//a[normalize-space()="عن المؤسسة"]')
  WebUI.waitForElementVisible(toAbout, 10)
  WebUI.click(toAbout)
  (Use the **actual** selector from the map, not this example text, unless it appears in the map.)

- **findTestObject** — **only** when the map line’s **RHS** is **exclusively** an Object Repository path (ASCII folder/object with **/**, e.g. \`Page_Home/btn_Login\`, and **no** # . [ xpath= // prefix). Then: \`WebUI.click(findTestObject('Page_Home/btn_Login'))\` with that **exact** RHS string.

- **FORBIDDEN:** \`findTestObject('عن المؤسسة')\`, \`findTestObject('Contact Us')\`, or any string that is **only** the human **label** before \`=\` on a selector line — these are **not** valid OR references and **will break** a pasted script.

- Never guess selectors; never invent Page_/btn_ paths unless that exact string appears as the **RHS** in the map.

========================
PER STEP (each click / type / verify on an element)
========================
1. WebUI.waitForElementVisible(to, 10) [or waitForElementClickable(to, 10)]
2. WebUI.click(to) / WebUI.setText(to, '...') / WebUI.setEncryptedText(to, '...') as the step requires
3. Optional: WebUI.verifyElementPresent(to, 10) or other verify* when the step asks to verify

========================
SMART STEP MAPPING
========================
- Visit / open URL → openBrowser(firstArg, FailureHandling.STOP_ON_FAILURE) + maximizeWindow + navigateToUrl(actualUrl)
- Click → wait + click flow with TestObject from map
- Input / type → wait + setText or setEncryptedText for passwords
- Verify → verify* methods tied to the same control or URL as the step

========================
OUTPUT FORMAT (STRICT)
========================
- Output **ONLY** Groovy source — no markdown, no explanations before/after the script, no code fences.
- Clean indentation. Use // Step: / // Purpose: comments only sparingly if they help readability (optional).

========================
QUALITY GATE
========================
- All mandatory imports present; TestObject + ConditionType used correctly; WebUI spelling (wait**F**orElementVisible).
- Waits before interactions; script ends with closeBrowser when appropriate.
- Locators copied verbatim from the EFFECTIVE map (including Arabic inside xpath).

`;
  }
  return `
========================
PRODUCTION SCRIPT CONTRACT (MOBILE — MUST FOLLOW)
========================
- Use ONLY valid Groovy + Katalon **Mobile.*** keywords (no WebUI.* for native/mobile web flows per platform rules above).
- Do NOT invent APIs or pseudo-code.
- Use **findTestObject('path')** only when that path appears in the EFFECTIVE map / project; do not invent Page_/btn_ paths.
- Before **Mobile.tap** / **Mobile.setText** / **Mobile.setEncryptedText**, use **Mobile.waitForElementPresent** (or your Studio’s equivalent wait) on the same TestObject with a reasonable timeout.
- Use **Mobile.verifyElementExist** / **Mobile.verifyElementVisible** when steps ask to verify or confirm a screen.
- Output **ONLY** Groovy — no markdown, no placeholders like <element>.
- Quality: valid syntax, waits before interactions, verifies when steps imply them, open/close or lifecycle per steps.

`;
}

function buildPlaywrightRealisticLocatorBlock(hasAutoOrCssInMap: boolean): string {
  if (!hasAutoOrCssInMap) return "";
  return `
=== PLAYWRIGHT / REALISTIC LOCATORS (MANDATORY WHEN THIS BLOCK APPEARS) ===
Auto-detected lines in REAL LOCATORS and EFFECTIVE LOCATOR MAP come from Playwright on the real page. The **selector text after "=" is ground truth** — copy it **verbatim** into Groovy. Do **not** substitute invented Object Repository paths such as 'Page_Home/btn_ContactUs' unless that **exact** string appears as the right-hand side of a locator line or in OBJECT REPOSITORY PATHS.

For each control you automate from the map:

1) **Right-hand side is CSS** (starts with #, ., [, *, or a tag name with optional classes/attrs) OR **xpath=…** OR **starts with //**:
   - Build an **inline** TestObject using the **MANDATORY IMPORTS** from PRODUCTION SCRIPT CONTRACT (short names TestObject, ConditionType — not fully-qualified class names in the body).
   - Example pattern (use a short **ASCII** id for \`new TestObject\`, not the Arabic LHS label; selector from map RHS only):
     TestObject tContact = new TestObject('contactBtn')
     tContact.addProperty('css', ConditionType.EQUALS, '#btn-contact')
   - For **xpath=…** or **//…** paths, use addProperty('xpath', ConditionType.EQUALS, '<value>') where <value> is the XPath string **without** the literal prefix "xpath=" if present.
   - Reuse **one** TestObject variable per control for wait + click + verify on that control.
   - **Never** \`findTestObject('…')\` with the text **before** "=" on these lines — that object does not exist after paste.

2) **Right-hand side is an Object Repository path** (looks like Folder/ObjectName with slashes, and is **not** CSS/XPath as above):
   - Use findTestObject('exact/path/from/map') only.

3) **Waits (Web — when you use a TestObject from the map for a click/type):** Immediately before WebUI.click / WebUI.setText / WebUI.setEncryptedText, call WebUI.waitForElementVisible(testObject, timeout) or WebUI.waitForElementClickable(testObject, timeout). Use correct spelling: **waitForElementVisible** (capital F).

4) **Verifications:** When a TEST STEP asks to verify navigation, page load, or success, use WebUI.verifyElementPresent, WebUI.verifyUrl, or WebUI.verifyTextPresent with **locators or URLs grounded in the steps or map** — do not invent unrelated assertions.

5) **Forbidden:** Guessing OR paths from this prompt’s examples, from page titles, or from product names. If the map gives #btn-contact for contact, your code must use that selector string, not a different path.

=== END PLAYWRIGHT REALISTIC LOCATORS ===
`;
}

function buildProjectImportSection(
  ctx: KatalonProjectContext,
  platform: Platform
): string {
  const head = [
    ctx.projectName ? `Project name: ${ctx.projectName}` : null,
    ctx.frameworkType ? `Framework type: ${ctx.frameworkType}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const hintBlock =
    ctx.importHints && ctx.importHints.length > 0
      ? `IMPORT WARNINGS (must follow):\n${ctx.importHints.map((h) => `- ${h}`).join("\n")}\n\n`
      : "";

  const lists = [
    bulletList("CUSTOM KEYWORDS (reuse with CustomKeywords — highest priority for covered flows):", ctx.keywords),
    bulletList(
      "OBJECT REPOSITORY PATHS (use findTestObject('path') exactly — do not invent alternate paths):",
      ctx.objectRepository
    ),
    bulletList(
      "EXISTING TEST CASE REFERENCES (Test Cases tree — match folder/naming patterns when suggesting paths in comments):",
      ctx.testCases
    ),
    bulletList(
      "TEST SUITE COLLECTIONS (Test Suites/*.ts — naming/structure context; output is still one Groovy test case unless steps explicitly ask for a suite file):",
      ctx.testSuites
    ),
  ].join("\n");

  const xmlBlock = ctx.sourceXml
    ? `
SOURCE PROJECT XML (authoritative — read structure, locators, and naming from this; bullet lists above are heuristics only):
${ctx.sourceXml}
`
    : "";

  const platNote =
    platform === "web"
      ? "WebUI / CustomKeywords only for browser steps (no raw Selenium)."
      : "Mobile + findTestObject + CustomKeywords as applicable (no raw Selenium).";

  return `
=== KATALON PROJECT IMPORT MODE (ACTIVE) ===
Behave as a framework maintainer for this project: maximize reuse; do not introduce a new architecture.
${head ? `${head}\n` : ""}
${hintBlock}${lists}
${xmlBlock}
IMPORT RULES (OVERRIDE generic “WebUI-first” habits where they conflict with lists above):
1. Keyword-first: If a step or flow matches a listed custom keyword (e.g. LoginHelper.login), call it as CustomKeywords.'ClassName.methodName'(args) — NEVER re-expand into raw WebUI/Mobile steps when that keyword already implements the flow.
2. Object Repository-first: If a control matches a listed OR path, use findTestObject('exact/path') — NEVER raw XPath/CSS/TestObject builders when that OR entry applies.
3. Never duplicate logic: Do not split a keyword’s responsibility back into low-level clicks/types.
4. Consistency: Match naming and style implied by frameworkType, listed test case paths, and test suite names; do not invent new keyword packages or OR folders.
5. Locator priority: (1) OBJECT REPOSITORY PATHS bullets (2) custom keywords (3) EFFECTIVE locator map lines from this request (4) inline TestObject from CSS/XPath ONLY when the EFFECTIVE map or Playwright recording supplies concrete selectors — NEVER invent findTestObject strings; NEVER treat .prj sourceFolder URLs (e.g. Include/scripts/groovy) as OR path prefixes.
6. Playwright recording: Map to keywords/OR when possible; otherwise use only selectors present in the recording or EFFECTIVE map — do not invent OR paths.
7. Output: ONLY valid Groovy Katalon script. No markdown fences, no prose before/after code. No Selenium WebDriver API.
8. End the script with this exact-style trailing comment block (fill with what you actually used; use “none” when empty):
/*
USED_KEYWORDS:
- (list each CustomKeywords line used, or none)

USED_OBJECTS:
- (list each findTestObject path used, or none)

FALLBACK_WEBUI:
- (list steps that required raw WebUI/Mobile without keyword/OR, or none)
*/
${platNote}
=== END PROJECT IMPORT ===
`;
}

/**
 * Builds the system + user prompt for Ollama to emit Katalon Groovy only.
 */
export function buildKatalonPrompt(params: {
  platform: Platform;
  steps: string[];
  userLocatorsText: string;
  autoLocatorsText?: string;
  testCaseName?: string;
  /** Raw Playwright-style script from the record pipeline — prefer mapping these actions to Katalon WebUI. */
  recordedPlaywrightScript?: string;
  /** When set, generation prioritizes listed keywords and OR paths over ad-hoc WebUI. */
  katalonProjectContext?: KatalonProjectContext;
  promptExtras?: PromptExtraOptions;
}): string {
  const { platform, steps, userLocatorsText, testCaseName } = params;
  const autoLocatorsText = (params.autoLocatorsText ?? "").trim();
  const recordedPlaywrightScript = (params.recordedPlaywrightScript ?? "").trim();
  const projectCtx = params.katalonProjectContext;
  const projectBlock = (() => {
    if (!projectCtx) return "";
    const orList = projectCtx.objectRepository ?? [];
    const tcList = projectCtx.testCases ?? [];
    const tsList = projectCtx.testSuites ?? [];
    const sel = selectOrPathsForPrompt(orList, steps);
    const hints = [...(projectCtx.importHints ?? [])];
    if (sel.truncated) {
      hints.push(
        `Object Repository: only ${sel.shown.length} of ${sel.total} paths appear in the list below (prompt size / model context). Heuristic STEP → OR SUGGESTIONS highlight likely matches; use Katalon Studio for the full tree. Server-side lint still checks findTestObject against all ${sel.total} imported paths.`
      );
    }
    const MAX_TC_PROMPT = 120;
    const MAX_TS_PROMPT = 80;
    let tcForPrompt = tcList;
    if (tcList.length > MAX_TC_PROMPT) {
      tcForPrompt = [...tcList].sort((a, b) => a.localeCompare(b)).slice(0, MAX_TC_PROMPT);
      hints.push(
        `Test cases: listing ${tcForPrompt.length} of ${tcList.length} imported paths below (prompt size).`
      );
    }
    let tsForPrompt = tsList;
    if (tsList.length > MAX_TS_PROMPT) {
      tsForPrompt = [...tsList].sort((a, b) => a.localeCompare(b)).slice(0, MAX_TS_PROMPT);
      hints.push(
        `Test suites: listing ${tsForPrompt.length} of ${tsList.length} imported names below (prompt size).`
      );
    }
    return buildProjectImportSection(
      {
        ...projectCtx,
        objectRepository: sel.shown.length > 0 ? sel.shown : orList,
        testCases: tcForPrompt.length > 0 ? tcForPrompt : undefined,
        testSuites: tsForPrompt.length > 0 ? tsForPrompt : undefined,
        importHints: hints,
      },
      platform
    );
  })();
  const extras = params.promptExtras;
  const profileBlock = buildGenerationProfileBlock(extras ?? {}, Boolean(projectCtx));
  const orSuggestionsBlock = extras?.orSuggestionsText?.trim()
    ? `${extras.orSuggestionsText.trim()}\n\n`
    : "";

  const stepsBlock = steps
    .map((s, i) => `${i + 1}. ${s.trim()}`)
    .filter((line) => line.replace(/^\d+\.\s*/, "").length > 0)
    .join("\n");

  const userTrim = userLocatorsText.trim();
  const autoFiltered = filterAutoLinesNotOverriddenByUser(userLocatorsText, autoLocatorsText);
  const mergedLocators = mergeLocatorTexts(userLocatorsText, autoLocatorsText).trim();

  const defaultEmpty =
    "(No locators provided — skip any step that would require an element locator.)";

  const realAutoSection =
    autoFiltered.length > 0
      ? `REAL LOCATORS (AUTO — Playwright; **subset chosen to match your TEST STEPS** (navigate-only lines do not add locators). Values after "=" are CSS selectors or xpath= strings; they are NOT Object Repository paths unless identical by coincidence. Prefer these when no USER path covers the same control.)
CRITICAL — AUTO LINE FORMAT: Text **before** "=" is a human-readable label only (often Arabic or aria text). **Never** pass that label to findTestObject('…') unless it is also a real OR path listed in OBJECT REPOSITORY. For auto lines, always use \`new TestObject('anyShortName')\` + addProperty with the **selector string after "="** (verbatim). If no auto line clearly matches a step’s target text (e.g. Arabic in the step), **omit** that click — do not substitute a different control’s label from the list.\n${autoFiltered}\n\n`
      : "";

  const userSection = `USER-DEFINED LOCATORS (Object Repository paths or manual entries — take precedence when the label matches the same control as an auto line):\n${
    userTrim || "(none)"
  }\n\n`;

  const mergedSection = `EFFECTIVE LOCATOR MAP (merged; user overrides auto on label conflict — use this as the primary checklist for matching steps to locators):\n${
    mergedLocators || defaultEmpty
  }`;

  const locatorBlock = `${realAutoSection}${userSection}${mergedSection}`;

  const stepArabicBindingBlock = buildStepArabicLocatorBindingBlock(steps, mergedLocators);

  const playwrightRealisticBlock = buildPlaywrightRealisticLocatorBlock(
    autoFiltered.length > 0 || mergedMapHasPlaywrightSelectors(mergedLocators)
  );

  const hasLocatorLines =
    userTrim.length > 0 || autoFiltered.length > 0 || Boolean(mergedLocators.trim());

  const noExtractedOr = !projectCtx?.objectRepository?.length;

  const antiInventBlock =
    !hasLocatorLines
      ? `
CRITICAL — EMPTY LOCATOR MAP (no manual locator lines and no merged auto-detect CSS/XPath in EFFECTIVE map):
- Do NOT fabricate findTestObject('…') paths (no guessing Page_* / btn_* / etxt_* OR paths).
- Do NOT concatenate Katalon project script paths (e.g. Include/scripts/groovy from a .prj file) with object names — those folders are not the Object Repository.
${projectCtx && noExtractedOr ? "- Project import contained no usable Object Repository path list: use Custom Keywords from the import only, or omit UI steps that need unknown elements.\n" : ""}`
      : "";

  const stepFidelityBlock = `
STEP-TO-CONTROL FIDELITY (non-negotiable):
- The **exact wording** of each TEST STEP line is the source of truth for **what** to automate. If a step says "contact us", "اتصل بنا", "خدمة العملاء", etc., you MUST NOT implement it as a click on Login, Sign in, or any unrelated control — that is a script error.
- If a step contains **Arabic** text and the EFFECTIVE LOCATOR MAP lists an xpath/css with that same Arabic, **use that selector string exactly** — never translate Arabic UI labels into another language in selectors (e.g. do not use #présidentie or “presidente” for “الرئيسية”).
- Instructional examples anywhere in this prompt (e.g. sample path names) are **not** real locators. Never emit findTestObject('Page_Login/btn_Login') or similar **unless** that **exact** string appears in the EFFECTIVE LOCATOR MAP or OBJECT REPOSITORY list above.
- If a step requires clicking an element but no locator line or OR path clearly matches that step’s intent, **omit** that click entirely (still implement earlier steps such as navigate). Do not substitute a "default" or "common" button.
- Do **not** add **extra** clicks or unrelated flows not implied by a numbered step line — **except** mandatory **wait-before-interact** and **verify** behavior defined in **PRODUCTION SCRIPT CONTRACT** (waits before WebUI.click/setText on elements; verifications when steps imply success/navigation), and the PLAYWRIGHT / REALISTIC LOCATORS section. Use correct Katalon spelling: WebUI.waitForElementVisible (capital F).
`;

  const recordingSection =
    recordedPlaywrightScript.length > 0
      ? platform === "web"
        ? `RECORDED PLAYWRIGHT ACTIONS (execute these interactions in Katalon WebUI — map to WebUI; do not invent selectors beyond what appears here and in the EFFECTIVE MAP below):\n${recordedPlaywrightScript}\n\nREAL USER STEPS (from recording / editor — align Groovy with this order):\n${stepsBlock}\n\n`
        : `RECORDED FLOW (browser-oriented — map each action to equivalent Mobile.* touch/input keywords and findTestObject from the EFFECTIVE MAP; do not use WebUI.* on mobile platform):\n${recordedPlaywrightScript}\n\nREAL USER STEPS (align Groovy with this order):\n${stepsBlock}\n\n`
      : "";

  const platformRules =
    platform === "web"
      ? `Use ONLY WebUI keywords for browser automation (e.g. WebUI.openBrowser, WebUI.maximizeWindow, WebUI.navigateToUrl, WebUI.click, WebUI.setText, WebUI.setEncryptedText for passwords, WebUI.verifyElementVisible, WebUI.waitForElementVisible, WebUI.sendKeys with Keys after adding import org.openqa.selenium.Keys when needed). Follow PRODUCTION SCRIPT CONTRACT: mandatory import block at top; runnable script without edits.`
      : `MOBILE PLATFORM — use ONLY Katalon built-in Mobile.* keywords (no WebUI.* for the same UI actions).

APP vs MOBILE WEB (critical):
- Steps about "login to app", "Superapp", "service list", "tap", "native screen", or in-app navigation describe a NATIVE or HYBRID app. For those flows do NOT use Mobile.openBrowser(). Start appropriately with Mobile.startExistingApplication('applicationId', false) and/or Mobile.startApplication('pathOrEmpty', false) only when the first steps imply a cold start; if the scenario assumes the app is already open, begin with a one-line comment // Preconditions: app logged in / on dashboard — then implement the listed steps only.
- Use Mobile.openBrowser('') or Mobile.openBrowser('https://...') ONLY when a step explicitly says to open a browser, a URL, or "mobile web" on the device.

Valid Mobile keyword families (map step wording to these; one keyword line per step where applicable):
- Lifecycle: Mobile.startApplication, Mobile.startExistingApplication, Mobile.closeApplication, Mobile.openBrowser (mobile web only, see above)
- Interaction: Mobile.tap(TestObject, false), Mobile.doubleTap, Mobile.longPress, Mobile.setText, Mobile.setEncryptedText, Mobile.clearText, Mobile.pressBack
- Wait / verify: Mobile.waitForElementPresent(TestObject, seconds), Mobile.verifyElementExist(TestObject, seconds), Mobile.verifyElementVisible(TestObject, seconds) — use the keyword names your Katalon version exposes; prefer wait before tap when steps imply loading

IMPORTS: Do NOT add import statements at the top (no import com.kms.katalon...TestObject, no import org.openqa.selenium.Keys). Katalon test cases already resolve keywords; use fully qualified org.openqa.selenium.Keys only inline if a step explicitly needs Enter and your Studio version requires it.`;

  const locatorRulesWeb =
    platform === "web"
      ? `
LOCATOR USAGE (WEB):
- **Paste-ready rule:** The generated script is pasted into a project that may have **no** Object Repository entries for this flow. Any map line whose RHS is **CSS or XPath** → **inline TestObject in the script** (mandatory). Do **not** use findTestObject with the **LHS label** or the step’s Arabic/English phrase.
${projectCtx ? "- PROJECT IMPORT is active: if the EFFECTIVE map gives an **OR path** as RHS for a control, you may use findTestObject(thatPath) **only for that line**. If the map gives Playwright CSS/XPath, still use inline TestObject even when OR lists exist. Match OR paths to the **same** control as the step — do not pick unrelated paths.\n" : ""}- When a locator line’s right-hand side is a repository path (no leading # / xpath= / //), use findTestObject('exact/path/from/that/line') only — never a path from memory or from examples in this prompt.
- When the right-hand side is CSS or XPath from Playwright (starts with #, ., [, tag, "xpath=", or "//"), you **must** use an inline TestObject with addProperty (see mandatory imports in PRODUCTION SCRIPT CONTRACT) — **never** findTestObject(mapLeftHandLabel) and **never** findTestObject unless the RHS itself is that OR path string.
- Copy selector strings **character-for-character** from EFFECTIVE LOCATOR MAP / REAL LOCATORS. Then pass that TestObject to WebUI.waitForElementVisible / WebUI.waitForElementClickable / WebUI.click / WebUI.setText / WebUI.verifyElementPresent as required by the TEST STEPS.
- Never invent selectors; only use values listed in REAL / USER / EFFECTIVE sections above.
`
      : "";

  const locatorRulesMobile =
    platform === "mobile"
      ? `
LOCATOR USAGE (MOBILE):
- Pass the same findTestObject('ObjectRepository/path') strings you would use on Web — but only to Mobile.* keywords (Mobile.tap(findTestObject('...'), false), etc.).
- Use full OR paths from the EFFECTIVE map / project import (e.g. Page_ServiceList/btn_Register). Do NOT shorten to a single bare word like 'ServiceList' unless that exact string appears as the full path in the locator list.
- If no locator exists for a control, omit that step (same as Web rules).
`
      : "";

  return `You are a senior test automation engineer specialized in Katalon Studio using Groovy and Katalon's WebUI keyword layer (Selenium-backed). Your task is to generate a complete, clean, production-ready Katalon test script from the TEST STEPS. Output ONLY valid Groovy 3 code for a Katalon test case. No markdown fences, no explanations outside comments, no prose before or after the code.

${testCaseName ? `Test case name (for comments only): ${testCaseName}\n` : ""}TARGET PLATFORM: ${platform.toUpperCase()}
${platformRules}
${locatorRulesWeb}${locatorRulesMobile}
${buildProductionScriptContract(platform)}
${profileBlock}
${projectBlock}
${antiInventBlock}
${stepFidelityBlock}
STRICT RULES:
- STEP COVERAGE (CRITICAL): Implement ONLY the numbered TEST STEPS listed at the bottom — one // Step: block per input line (or omit that line entirely only when locator rules forbid UI). Do NOT add extra steps, searches, clicks, verifications, or “typical user flows” that are not literally written in those lines. Example: a single step "visit google" means at most open browser + WebUI.navigateToUrl('https://www.google.com') (or similar) — NOT typing queries, clicking results, or new assertions unless the step text says so.
- Example for multi-step: Step 1 "visit https://example.com" → WebUI.openBrowser('', FailureHandling.STOP_ON_FAILURE) then WebUI.navigateToUrl('https://example.com') (or pass the URL as the first openBrowser argument). Step 2 "click contact us" → only a click that matches **contact** semantics from the locator map; if none, **stop after step 1** — do not click Login.
- Use locators from the sections above only. Never guess paths or selectors.
- If a step needs an element but no matching locator exists in the EFFECTIVE map, OMIT that step entirely (do not comment that you skipped it).
- Do NOT use raw Selenium WebDriver APIs; use Katalon built-in keywords only.${platform === "web" ? " For WEB: you MUST start the script with the **MANDATORY IMPORTS** block in PRODUCTION SCRIPT CONTRACT (exact order: FailureHandling, WebUI, TestObject, ConditionType, Keys; add findTestObject static import only when \`findTestObject(...)\` is used)." : " Do NOT add import statements at the top (Katalon resolves keywords); use fully qualified org.openqa.selenium.Keys only inline if an explicit step needs Enter and your Studio version requires it."}
${projectCtx ? "- PROJECT IMPORT: obey IMPORT RULES above — keyword-first, OR-first, no duplicated keyword logic.\n" : ""}
- For each included step, use this comment pattern immediately before the code:
  // Step: <original step text>
  // Purpose: <brief purpose>
- Then the Katalon keyword lines.
- Use Groovy 3 syntax.${platform === "web" ? " Use imported TestObject and ConditionType (see PRODUCTION SCRIPT CONTRACT) — not fully-qualified class names for those two. **WEB paste-ready:** \`findTestObject\` is **disallowed** for Arabic/English **labels** or text copied from TEST STEPS; use \`new TestObject\` + \`addProperty\` with the selector from the map RHS whenever that RHS is CSS/XPath." : ""}
- Sequence must match the order of TEST STEPS below only; do not insert actions between them that are not their own step lines.

WEB step mapping hints (use ONLY when a TEST STEP line clearly requires that action; otherwise skip the hint — placeholders '...' mean “from EFFECTIVE map only”, never invented):
- Open browser → WebUI.openBrowser('', FailureHandling.STOP_ON_FAILURE) or pass the URL as the first argument and FailureHandling.STOP_ON_FAILURE as the second
- Navigate → WebUI.navigateToUrl('...')
- Click → If map shows CSS/XPath for that step’s control: build TestObject with addProperty then WebUI.click(thatObject). If map shows OR path: WebUI.click(findTestObject('path/from/map')). Never mix invented OR names with Playwright selectors.
- Type text → WebUI.setText(...)
- Password → WebUI.setEncryptedText(...)
- Enter key → with \`import org.openqa.selenium.Keys\`: WebUI.sendKeys(..., Keys.chord(Keys.ENTER))
- Before click/type on a TestObject → WebUI.waitForElementVisible or WebUI.waitForElementClickable (see PRODUCTION SCRIPT CONTRACT)
- Verify → WebUI.verifyElementPresent / verifyTextPresent / verifyMatch / verifyElementVisible when steps imply verification, navigation success, or visibility checks

MOBILE step mapping hints (map each TEST STEP line to the minimum Mobile.* calls; do not collapse "Login" + "Navigate" + "Tap" into one tap):
- Open app / launch → Mobile.startExistingApplication('com.example.app', false) or Mobile.startApplication('', false) with comment to set APK/IPA path — NOT Mobile.openBrowser unless step says browser
- Open URL on device browser → Mobile.openBrowser('https://...')
- Tap / click UI → Mobile.tap(findTestObject('...'), false)
- Type / enter text → Mobile.setText(findTestObject('...'), 'value'); password fields → Mobile.setEncryptedText
- Wait for screen or element → Mobile.waitForElementPresent(findTestObject('...'), timeoutSeconds)
- Assert on screen → Mobile.verifyElementExist or Mobile.verifyElementVisible(findTestObject('...'), timeoutSeconds)
- Back → Mobile.pressBack()

${recordingSection}${orSuggestionsBlock}${locatorBlock}
${stepArabicBindingBlock}
${playwrightRealisticBlock}
TEST STEPS (normalize and implement only where rules allow):
${stepsBlock}

OUTPUT: Return ONLY the Groovy script body suitable for a Katalon test case. Start with a comment line // Katalon Groovy — generated ${platform} test. No markdown.`;
}
