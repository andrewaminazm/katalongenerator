import type { FailureType, SuggestedFix, HealingSuggestion } from "./types.js";
import type { LocatorAnalysis } from "./locatorFailureAnalyzer.js";
import type { TimingAnalysis } from "./timingIssueAnalyzer.js";
import type { ApiAnalysis } from "./apiFailureAnalyzer.js";
import type { ParsedStacktrace } from "./stacktraceParser.js";

export function buildSuggestedFixes(params: {
  failureType: FailureType;
  locator: LocatorAnalysis;
  timing: TimingAnalysis;
  api: ApiAnalysis;
  parsed?: ParsedStacktrace | null;
  memoryHints?: string[];
  corpus?: string;
}): SuggestedFix[] {
  const fixes: SuggestedFix[] = [];
  let id = 0;
  const add = (
    title: string,
    description: string,
    category: SuggestedFix["category"],
    priority: SuggestedFix["priority"],
    codeExample?: string
  ) => {
    fixes.push({
      id: `fix-${++id}`,
      title,
      description,
      category,
      priority,
      codeExample,
    });
  };

  if (params.failureType === "LOCATOR" && params.locator.detected) {
    add(
      "Stabilize locator strategy",
      params.locator.recommendation,
      "LOCATOR",
      "high",
      "WebUI.waitForElementClickable(findTestObject('Page/element'), 30)\nWebUI.click(findTestObject('Page/element'))"
    );
    add(
      "Try locator healing",
      "POST failure details to /api/heal/locator for rule-based and AI-assisted recovery.",
      "healing",
      "medium"
    );
  }

  if (params.failureType === "TIMING" && params.timing.detected) {
    add(
      "Replace fixed delays with smart waits",
      params.timing.recommendation,
      "TIMING",
      "high",
      "WebUI.waitForElementVisible(findTestObject('Page/element'), 30)"
    );
    if (params.memoryHints?.some((h) => /WaitHelper/i.test(h))) {
      add(
        "Use project wait helper",
        "This project commonly uses WaitHelper — align with team pattern instead of raw WebUI.delay().",
        "architecture",
        "high",
        "WaitHelper.waitVisible('Page/element')"
      );
    }
  }

  if (params.failureType === "API" && params.api.detected) {
    add("Fix API contract or auth", params.api.recommendation, "API", "high");
  }

  if (params.failureType === "ASSERTION") {
    add(
      "Stabilize assertion timing",
      "Wait for UI state before verify; use soft verification if business allows.",
      "ASSERTION",
      "medium"
    );
  }

  if (params.parsed?.katalonKeyword) {
    add(
      "Inspect failing keyword",
      `Review implementation of CustomKeywords.'${params.parsed.katalonKeyword}' and its Object Repository dependencies.`,
      "FRAMEWORK",
      "high"
    );
  }

  const corpus = params.corpus ?? "";

  if (
    /unable to get the url of the current window|switchtowindow|new tab|newtab/i.test(corpus) ||
    params.failureType === "BROWSER_AUTOMATION"
  ) {
    add(
      "Switch to the new browser tab",
      "After a link opens a new tab, WebDriver still points at the old window until you switch.",
      "BROWSER_AUTOMATION",
      "high",
      "// After click that opens new tab:\nWebUI.switchToWindowIndex(1)\n// or:\nWebUI.switchToWindowTitle('Page title here')"
    );
    add(
      "Confirm the link opens a new tab",
      "Run manually: footer link should open target=_blank. If it navigates in the same tab, update the test flow.",
      "BROWSER_AUTOMATION",
      "medium"
    );
  }

  return fixes.slice(0, 8);
}

export function buildHealingSuggestions(locator: LocatorAnalysis): HealingSuggestion[] {
  if (!locator.detected) return [];
  return [
    {
      endpoint: "POST /api/heal/locator",
      description:
        "Send stepId, action, failedLocator {type, value}, url, and optional screenshot to the locator healing engine.",
      payloadHint: {
        stepId: "step-1",
        action: "click",
        failedLocator: { type: "xpath", value: "//button[@id='submit']" },
      },
    },
    {
      endpoint: "GET /api/heal/memory",
      description: "Review past successful healings for similar locators on this application.",
    },
  ];
}

export function buildArchitectureInsights(corpus: string, memoryHints?: string[]): string[] {
  const insights: string[] = [];
  if (/delay\(|thread\.sleep/i.test(corpus)) {
    insights.push("Overuse of fixed delay() detected — increases flakiness and run time.");
  }
  if (/\[\d+\]|nth-child|\/\/\*\[@id=/i.test(corpus)) {
    insights.push("Fragile XPath strategy (positional/index) — migrate to semantic OR objects.");
  }
  if ((corpus.match(/waitFor/gi) ?? []).length > 5) {
    insights.push("Many wait calls in failure context — consider centralized WaitHelper.");
  }
  if (memoryHints?.length) {
    insights.push(...memoryHints.slice(0, 3));
  }
  return insights.slice(0, 6);
}
