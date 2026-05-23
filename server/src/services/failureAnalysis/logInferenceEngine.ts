import type { FailureType } from "./types.js";
import type { KatalonExecutionLogAnalysis, DetectedLogPattern } from "./katalonExecutionLogAnalyzer.js";
import { pickPrimaryFailureType } from "./failureClassifier.js";

export interface LogInferenceResult {
  failureType: FailureType;
  rootCause: string;
  rootCauseSummary: string;
  secondaryFactors: string[];
  detectedPatterns: DetectedLogPattern[];
  flakyTimingLikely: boolean;
  inferenceConfidence: number;
}

/**
 * Infer root cause and classification from parsed Katalon execution logs (no stacktrace required).
 */
export function inferFromKatalonLogs(logAnalysis: KatalonExecutionLogAnalysis): LogInferenceResult {
  const patterns = logAnalysis.patterns;
  const signals = logAnalysis.classificationSignals;

  let failureType = pickPrimaryFailureType(signals);
  if (failureType === "UNKNOWN" && patterns.length > 0) {
    failureType = patterns[0].failureType;
  }

  const topPattern = patterns.sort((a, b) => b.confidence - a.confidence)[0];
  const failedObj = logAnalysis.failedTestObject;
  const failedKw = logAnalysis.failedKeyword;

  let rootCause = "The Katalon test failed during execution.";
  let rootCauseSummary = "Review the execution log sequence around the FAILED line.";

  if (topPattern?.id === "window-url-missing") {
    rootCause =
      "After a new tab or window change, Katalon tried to read the page URL but no browser window was selected. Add WebUI.switchToWindowIndex(1) or switchToWindowTitle(...) after the click that opens the tab.";
    rootCauseSummary =
      "Browser tab/window switch missing — typical for footer links that open target=_blank.";
    failureType = "BROWSER_AUTOMATION";
  } else if (topPattern) {
    rootCause = topPattern.inference;
    rootCauseSummary = topPattern.pattern;
  }

  if (failedObj && failureType === "LOCATOR") {
    rootCause = `Katalon could not complete the action on test object '${failedObj}'. ${topPattern?.inference ?? "Verify Object Repository path and page state."}`;
    rootCauseSummary = `Check OR entry '${failedObj}' and add WebUI.waitForElementClickable before interaction.`;
  }

  if (logAnalysis.timing.repeatedTimeouts && failureType === "TIMING") {
    rootCause =
      logAnalysis.timing.waitForVisibleTimeouts > 0
        ? "Login or target element became visible after the waitForElementVisible timeout threshold."
        : "A Katalon wait timed out before the UI reached the expected state.";
    rootCauseSummary =
      "Use smart explicit waits (WebUI.waitForElementVisible / waitForElementClickable) or a reusable framework wait helper instead of WebUI.delay().";
  }

  if (logAnalysis.exceptionMessage) {
    rootCause = `${rootCause} (${logAnalysis.exceptionMessage.slice(0, 200)})`;
  }

  const secondaryFactors: string[] = [
    ...logAnalysis.warnings,
    logAnalysis.timing.summary,
    ...patterns.slice(1, 4).map((p) => p.pattern),
  ].filter((v, i, a) => a.indexOf(v) === i);

  if (failedKw) {
    secondaryFactors.unshift(`Failing keyword: ${failedKw}`);
  }
  if (logAnalysis.platform !== "unknown") {
    secondaryFactors.push(`Execution platform signal: Katalon ${logAnalysis.platform}`);
  }

  const inferenceConfidence = Math.min(
    0.95,
    logAnalysis.parseConfidence * 0.6 + (topPattern?.confidence ?? 0.35) * 0.4
  );

  return {
    failureType,
    rootCause,
    rootCauseSummary,
    secondaryFactors: secondaryFactors.slice(0, 8),
    detectedPatterns: patterns,
    flakyTimingLikely: logAnalysis.timing.flakyTimingLikely,
    inferenceConfidence: Math.round(inferenceConfidence * 100) / 100,
  };
}
