import type { Platform } from "../types/index.js";
import {
  filterAutoLinesNotOverriddenByUser,
  mergeLocatorTexts,
} from "./playwright.js";

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
}): string {
  const { platform, steps, userLocatorsText, testCaseName } = params;
  const autoLocatorsText = (params.autoLocatorsText ?? "").trim();
  const recordedPlaywrightScript = (params.recordedPlaywrightScript ?? "").trim();

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
      ? `REAL LOCATORS (AUTO-GENERATED FROM LIVE PAGE — values after "=" are CSS selectors or xpath= strings from Playwright; they are NOT Object Repository paths unless identical by coincidence. Prefer these for accuracy when no USER path covers the same control.)\n${autoFiltered}\n\n`
      : "";

  const userSection = `USER-DEFINED LOCATORS (Object Repository paths or manual entries — take precedence when the label matches the same control as an auto line):\n${
    userTrim || "(none)"
  }\n\n`;

  const mergedSection = `EFFECTIVE LOCATOR MAP (merged; user overrides auto on label conflict — use this as the primary checklist for matching steps to locators):\n${
    mergedLocators || defaultEmpty
  }`;

  const locatorBlock = `${realAutoSection}${userSection}${mergedSection}`;

  const recordingSection =
    recordedPlaywrightScript.length > 0
      ? `RECORDED PLAYWRIGHT ACTIONS (execute these interactions in Katalon WebUI — map to WebUI; do not invent selectors beyond what appears here and in the EFFECTIVE MAP below):\n${recordedPlaywrightScript}\n\nREAL USER STEPS (from recording / editor — align Groovy with this order):\n${stepsBlock}\n\n`
      : "";

  const platformRules =
    platform === "web"
      ? `Use ONLY WebUI keywords for browser automation (e.g. WebUI.openBrowser, WebUI.navigateToUrl, WebUI.click, WebUI.setText, WebUI.setEncryptedText for passwords, WebUI.verifyElementVisible, WebUI.waitForElementVisible, WebUI.sendKeys with org.openqa.selenium.Keys).`
      : `Use ONLY Mobile keywords for mobile automation (e.g. Mobile.tap, Mobile.setText, Mobile.verifyElementVisible, Mobile.waitForElementPresent as appropriate).`;

  const locatorRulesWeb =
    platform === "web"
      ? `
LOCATOR USAGE (WEB):
- When the right-hand side looks like a repository path (e.g. Page_Login/btn_Login with no leading # or xpath=), use findTestObject('that/path').
- When the right-hand side is CSS (starts with #, ., [, or tag.) or starts with "xpath=", build a com.kms.katalon.core.testobject.TestObject in-line: addProperty("css", com.kms.katalon.core.testobject.ConditionType.EQUALS, "...") OR addProperty("xpath", ...) for xpath= strings (strip the "xpath=" prefix for the property value). Then pass that TestObject to WebUI.click / WebUI.setText / etc.
- Never invent selectors; only use values listed in REAL / USER / EFFECTIVE sections above.
`
      : "";

  return `You are a senior Katalon Studio automation expert. Output ONLY valid Groovy 3 code for Katalon test cases. No markdown fences, no explanations outside comments, no prose before or after the code.

${testCaseName ? `Test case name (for comments only): ${testCaseName}\n` : ""}TARGET PLATFORM: ${platform.toUpperCase()}
${platformRules}
${locatorRulesWeb}
STRICT RULES:
- Use locators from the sections above only. Never guess paths or selectors.
- If a step needs an element but no matching locator exists in the EFFECTIVE map, OMIT that step entirely (do not comment that you skipped it).
- Do NOT use raw Selenium WebDriver APIs; use Katalon built-in keywords only.
- For each included step, use this comment pattern immediately before the code:
  // Step: <original step text>
  // Purpose: <brief purpose>
- Then the Katalon keyword lines.
- Use Groovy 3 syntax. Prefer fully-qualified com.kms.katalon.core.testobject.ConditionType if you add TestObject properties for auto-generated CSS/XPath.
- Sequence must match the logical order of steps that have locators where applicable; for navigation-only steps without locators, follow mapping rules below.

WEB step mapping hints:
- Open browser → WebUI.openBrowser('') or with URL if given
- Navigate → WebUI.navigateToUrl('...')
- Click → WebUI.click(findTestObject('...')) OR WebUI.click(testObjectWithCssOrXpath)
- Type text → WebUI.setText(findTestObject('...'), 'value') OR WebUI.setText(testObjectWithCssOrXpath, 'value')
- Password → WebUI.setEncryptedText(findTestObject('...'), 'value')
- Enter key → WebUI.sendKeys(findTestObject('...'), org.openqa.selenium.Keys.chord(org.openqa.selenium.Keys.ENTER))
- Wait visible → WebUI.waitForElementVisible(findTestObject('...'), timeoutSeconds)
- Verify visible → WebUI.verifyElementVisible(findTestObject('...'))

MOBILE step mapping hints:
- Tap → Mobile.tap(findTestObject('...'), optional false)
- Input → Mobile.setText(findTestObject('...'), 'value')
- Verify → Mobile.verifyElementVisible(findTestObject('...'), timeoutSeconds)

${recordingSection}${locatorBlock}

TEST STEPS (normalize and implement only where rules allow):
${stepsBlock}

OUTPUT: Return ONLY the Groovy script body suitable for a Katalon test case. Start with a comment line // Katalon Groovy — generated ${platform} test. No markdown.`;
}
