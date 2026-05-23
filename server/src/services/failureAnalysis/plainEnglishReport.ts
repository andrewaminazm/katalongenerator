import type { FailureAnalysisResult, FailureType, SuggestedFix } from "./types.js";
import type { KatalonExecutionLogAnalysis } from "./katalonExecutionLogAnalyzer.js";

export interface PlainEnglishReport {
  headline: string;
  whatHappened: string;
  likelyReason: string;
  stepsToTry: string[];
  errorSnippet?: string;
  testName?: string;
}

const TYPE_HEADLINES: Record<FailureType, string> = {
  LOCATOR: "Katalon could not find or click an element on the page",
  TIMING: "The page was not ready in time",
  API: "A backend API call failed during the test",
  ASSERTION: "An expected value did not match what was on screen",
  ENVIRONMENT: "The test environment or server had a problem",
  TEST_DATA: "Login or test data looks wrong or expired",
  FRAMEWORK: "A Katalon keyword or script step failed",
  BROWSER_AUTOMATION: "The browser window or tab was in the wrong state",
  UNKNOWN: "The test failed during execution",
};

function extractTestName(corpus: string, metadata?: { testName?: string }): string | undefined {
  if (metadata?.testName?.trim()) return metadata.testName.trim();
  const failedLine = corpus.match(/(?:Test Cases\/[^\s]+|TC\d+[^\s]*)/i)?.[0];
  return failedLine;
}

function extractErrorSnippet(corpus: string): string | undefined {
  const m = corpus.match(
    /(?:StepFailedException|Exception):\s*([^\n]+)/i
  );
  if (m?.[1]) return m[1].trim().slice(0, 200);
  const unable = corpus.match(/Unable to [^\n]+/i)?.[0];
  return unable?.trim().slice(0, 200);
}

function isWindowTabIssue(corpus: string): boolean {
  return /unable to get the url of the current window|cannot get.*url.*current window|no such window|target window already closed/i.test(
    corpus
  );
}

function isNewTabTest(corpus: string, testName?: string): boolean {
  const t = `${testName ?? ""} ${corpus}`.toLowerCase();
  return /newtab|new_tab|new tab|switchtowindow|window handle/i.test(t);
}

function buildWindowTabReport(
  testName: string | undefined,
  errorSnippet: string | undefined
): PlainEnglishReport {
  const newTab = isNewTabTest("", testName ?? "");
  return {
    headline: newTab
      ? "The test opened (or tried to open) a new tab, but Katalon was still on the old window"
      : "Katalon lost track of which browser window/tab is active",
    whatHappened: newTab
      ? `Your test "${testName ?? "footer / new-tab link"}" failed because Katalon tried to read or act on the page URL while no valid browser window was selected — often right after a link opens a new tab.`
      : "Katalon called a keyword that needs the current page URL, but WebDriver had no active window (closed tab, wrong window, or switch missing).",
    likelyReason:
      "When a link opens a new tab (target=_blank), you must switch to that tab with WebUI.switchToWindowIndex(...) or switchToWindowTitle(...) before verify, getUrl, or clicks on the new page.",
    stepsToTry: [
      "Right after the click that opens the new tab, add: WebUI.switchToWindowIndex(1) (index 1 = second tab; use 0 for the first).",
      "Or switch by title: WebUI.switchToWindowTitle('Ministry of Finance') — use the real tab title from a manual run.",
      "Confirm the footer link actually opens a new tab in the browser (not the same tab).",
      "Avoid getUrl / verify on the original window until after switchToWindow.",
      "If the popup is blocked, allow pop-ups for the test browser profile in Katalon.",
    ],
    errorSnippet,
    testName,
  };
}

function fixesToSteps(fixes: SuggestedFix[], max = 4): string[] {
  return fixes.slice(0, max).map((f, i) => `${i + 1}. ${f.title}: ${f.description}`);
}

function filterNoiseFactors(factors: string[]): string[] {
  const noise =
    /inspect the failing keyword|StepFailedException:|No strong timing anomaly|Execution platform signal|reproducible defect rather than flakiness|Katalon test object \/ locator failure|Custom Keyword execution error/i;
  return factors.filter((f) => f.length > 10 && !noise.test(f));
}

export function buildPlainEnglishReport(
  draft: FailureAnalysisResult,
  corpus: string,
  logAnalysis: KatalonExecutionLogAnalysis | null,
  metadata?: { testName?: string; failedStep?: string }
): PlainEnglishReport {
  const testName = extractTestName(corpus, metadata);
  const errorSnippet =
    extractErrorSnippet(corpus) ??
    logAnalysis?.exceptionMessage?.slice(0, 200) ??
    draft.executionLogInsights?.failingStepMessage?.slice(0, 200);

  if (isWindowTabIssue(corpus) || isNewTabTest(corpus, testName)) {
    return buildWindowTabReport(testName, errorSnippet);
  }

  const failedObj = logAnalysis?.failedTestObject ?? draft.executionLogInsights?.failedTestObject;
  const failedKw = logAnalysis?.failedKeyword ?? draft.executionLogInsights?.failedKeyword;

  let whatHappened = `The test failed`;
  if (testName) whatHappened = `Test "${testName}" failed`;
  if (failedObj) {
    whatHappened += ` while using Object Repository object '${failedObj}'.`;
  } else if (errorSnippet) {
    whatHappened += `: ${errorSnippet}`;
  } else {
    whatHappened += " during a Katalon keyword step.";
  }

  let likelyReason = draft.rootCauseSummary.replace(/^Detected pattern:\s*/i, "");
  if (/inspect the failing keyword/i.test(likelyReason)) {
    likelyReason = TYPE_HEADLINES[draft.failureType] ?? likelyReason;
  }

  if (draft.failureType === "LOCATOR" && failedObj) {
    likelyReason = `The element '${failedObj}' was missing, hidden, or not clickable when the step ran.`;
  }
  if (draft.failureType === "TIMING") {
    likelyReason =
      logAnalysis?.timing.repeatedTimeouts
        ? "A wait timed out — the UI loaded slower than the timeout or the locator never appeared."
        : "The step ran before the page finished loading or animating.";
  }

  const stepsFromFixes = fixesToSteps(draft.suggestedFixes);
  const stepsToTry =
    stepsFromFixes.length > 0
      ? stepsFromFixes
      : defaultStepsForType(draft.failureType, failedObj, failedKw);

  if (metadata?.failedStep?.trim()) {
    stepsToTry.unshift(`Check the step you noted as failed: "${metadata.failedStep.trim()}".`);
  }

  return {
    headline: TYPE_HEADLINES[draft.failureType] ?? TYPE_HEADLINES.UNKNOWN,
    whatHappened,
    likelyReason,
    stepsToTry: stepsToTry.slice(0, 6),
    errorSnippet,
    testName,
  };
}

function defaultStepsForType(
  type: FailureType,
  failedObj?: string,
  failedKw?: string
): string[] {
  switch (type) {
    case "LOCATOR":
      return [
        failedObj
          ? `Open Object Repository and verify '${failedObj}' still exists and matches the live page.`
          : "Verify the test object path in Object Repository matches the current UI.",
        "Add WebUI.waitForElementVisible / waitForElementClickable before click.",
        "Re-run with a screenshot at failure to see overlays or wrong page.",
      ];
    case "TIMING":
      return [
        "Replace WebUI.delay() with waitForElementVisible or waitForElementClickable.",
        "Increase timeout (e.g. 30s) for slow pages.",
        "Check for loading spinners blocking the element.",
      ];
    case "API":
      return [
        "Check API response in the log for status code and body.",
        "Verify test environment URL and auth tokens.",
      ];
    case "ASSERTION":
      return [
        "Wait for UI to settle before verify keywords.",
        "Compare expected vs actual in the Katalon report.",
      ];
    default:
      return [
        failedKw ? `Review Custom Keyword '${failedKw}' and its test objects.` : "Find the first [FAILED] line in the log and fix that step.",
        "Re-run the test in Katalon Studio with the same profile and browser.",
        "Paste a longer log slice if the failure line is missing context.",
      ];
  }
}

export function filterSecondaryFactorsForDisplay(factors: string[]): string[] {
  return filterNoiseFactors(factors).slice(0, 5);
}
