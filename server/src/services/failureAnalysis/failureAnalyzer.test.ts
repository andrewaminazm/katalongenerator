import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeFailure } from "./failureAnalyzer.js";
import { parseStacktrace } from "./stacktraceParser.js";
import { classifyFailureSignals, pickPrimaryFailureType } from "./failureClassifier.js";

describe("stacktraceParser", () => {
  it("parses NoSuchElementException with Katalon runtime hints", () => {
    const p = parseStacktrace(
      `org.openqa.selenium.NoSuchElementException: no such element
  at com.kms.katalon.core.webui.keyword.builtin.ClickKeyword.click(ClickKeyword.groovy:52)
  at CustomKeywords.'common.WebUiHelpers.tapButton'(findTestObject('Page/btn_Submit'))`
    );
    assert.ok(p);
    assert.match(p!.exceptionType, /NoSuchElementException/);
    assert.ok(p!.seleniumHints.includes("selenium_element"));
    assert.ok(p!.katalonHints.includes("katalon_runtime"));
    assert.equal(p!.katalonKeyword, "common.WebUiHelpers.tapButton");
  });
});

describe("failureClassifier", () => {
  it("classifies timing from timeout logs", () => {
    const signals = classifyFailureSignals(
      "Timed out after 30 seconds waiting for element visible",
      null
    );
    const type = pickPrimaryFailureType(signals);
    assert.equal(type, "TIMING");
  });
});

describe("analyzeFailure", () => {
  it("returns structured analysis for locator failure", async () => {
    const result = await analyzeFailure({
      stacktrace: `com.kms.katalon.core.exception.StepFailedException: Unable to click on object 'Page/btn_Submit'
  at com.kms.katalon.core.webui.keyword.builtin.ClickKeyword.click(ClickKeyword.groovy:52)
  at WebUI.click(findTestObject('Page/btn_Submit'))`,
      logs: "FAILED: WebUI.click findTestObject('Page/btn_Submit')",
      katalonReport: "Test Cases/Login/LoginTest FAILED",
    });
    assert.ok(result.rootCause);
    assert.equal(result.failureType, "LOCATOR");
    assert.ok(result.rootCauseConfidence >= 0.25);
    assert.ok(result.suggestedFixes.length > 0);
    assert.ok(result.analyzedAt);
  });

  it("detects API failures", async () => {
    const result = await analyzeFailure({
      apiResponse: "HTTP 401 Unauthorized\nInvalid token",
      logs: "WS.sendRequest failed",
    });
    assert.equal(result.failureType, "API");
    assert.ok(result.apiInsights?.authIssue);
  });

  it("returns plainEnglish for new-tab window URL failures", async () => {
    const result = await analyzeFailure({
      logs: `Test Cases/footer/links/TC01_FooterLink_MinistryOfFinance_NewTab FAILED.
Reason:
com.kms.katalon.core.exception.StepFailedException: Unable to get the url of the current window`,
    });
    assert.ok(result.plainEnglish);
    assert.match(result.plainEnglish!.headline, /tab|window/i);
    assert.ok(
      result.plainEnglish!.stepsToTry.some((s) => /switchToWindow/i.test(s)),
      "expected switchToWindow guidance"
    );
    assert.equal(result.failureType, "BROWSER_AUTOMATION");
  });
});
