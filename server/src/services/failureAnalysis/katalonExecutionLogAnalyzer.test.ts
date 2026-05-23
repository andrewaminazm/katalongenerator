import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeKatalonExecutionLog } from "./katalonExecutionLogAnalyzer.js";
import { inferFromKatalonLogs } from "./logInferenceEngine.js";
import { analyzeFailure } from "./failureAnalyzer.js";

const SAMPLE_LOG = `
[INFO] Starting test case LoginTest
[INFO] WebUI.openBrowser('https://app.example.com')
[INFO] WebUI.waitForElementVisible(findTestObject('Page_Login/btn_Login'), 30)
[WARN] WebUI.waitForElementVisible(findTestObject('Page_Login/btn_Login'), 30) - timeout
[INFO] WebUI.delay(2)
[INFO] Clicking element 'btn_Login'
[FAILED] Unable to click on object 'Page_Login/btn_Login'
com.kms.katalon.core.exception.StepFailedException: Unable to click on object 'Page_Login/btn_Login'
`;

describe("analyzeKatalonExecutionLog", () => {
  it("parses execution sequence and failing test object from logs only", () => {
    const a = analyzeKatalonExecutionLog(SAMPLE_LOG);
    assert.ok(a.steps.length >= 5);
    assert.equal(a.failedTestObject, "Page_Login/btn_Login");
    assert.ok(a.patterns.some((p) => p.id === "wait-visible-timeout" || p.id === "unable-interact"));
    assert.ok(a.parseConfidence >= 0.55);
    assert.equal(a.logOnlyMode, true);
    assert.ok(a.timeline.length > 0);
  });

  it("detects WebUI.delay pattern", () => {
    const a = analyzeKatalonExecutionLog(SAMPLE_LOG);
    assert.ok(a.timing.fixedDelaysUsed);
    assert.ok(a.patterns.some((p) => p.id === "fixed-delay"));
  });
});

describe("inferFromKatalonLogs", () => {
  it("infers timing/locator root cause without stacktrace", () => {
    const logAnalysis = analyzeKatalonExecutionLog(SAMPLE_LOG);
    const inf = inferFromKatalonLogs(logAnalysis);
    assert.ok(inf.rootCause.length > 20);
    assert.ok(inf.inferenceConfidence >= 0.5);
    assert.ok(["LOCATOR", "TIMING"].includes(inf.failureType));
  });
});

describe("analyzeFailure log-only", () => {
  it("returns full analysis from Katalon logs only", async () => {
    const result = await analyzeFailure({ logs: SAMPLE_LOG });
    assert.equal(result.logOnlyMode, true);
    assert.ok(result.rootCauseConfidence >= 0.5);
    assert.ok(result.suggestedFixConfidence > 0);
    assert.ok(result.detectedPatterns.length > 0);
    assert.ok(result.executionLogInsights?.failedTestObject?.includes("btn_Login"));
  });
});
