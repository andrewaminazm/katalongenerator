import type { FailureType } from "./types.js";
import type { TimelineEvent } from "./types.js";
import type { ClassificationSignal } from "./failureClassifier.js";

export type KatalonLogLevel = "INFO" | "WARN" | "FAILED" | "ERROR" | "DEBUG" | "UNKNOWN";

export interface KatalonLogStep {
  lineIndex: number;
  level: KatalonLogLevel;
  raw: string;
  message: string;
  keyword?: string;
  testObject?: string;
  elapsedMs?: number;
  isRetry?: boolean;
  isWait?: boolean;
}

export interface DetectedLogPattern {
  id: string;
  pattern: string;
  inference: string;
  failureType: FailureType;
  confidence: number;
}

export interface KatalonTimingAnalysis {
  repeatedWaits: boolean;
  repeatedTimeouts: boolean;
  fixedDelaysUsed: boolean;
  retryAttempts: number;
  flakyTimingLikely: boolean;
  waitForVisibleTimeouts: number;
  summary: string;
}

export interface KatalonExecutionLogAnalysis {
  steps: KatalonLogStep[];
  failingStep?: KatalonLogStep;
  failedTestObject?: string;
  failedKeyword?: string;
  exceptionMessage?: string;
  platform: "web" | "mobile" | "api" | "mixed" | "unknown";
  timing: KatalonTimingAnalysis;
  patterns: DetectedLogPattern[];
  classificationSignals: ClassificationSignal[];
  timeline: TimelineEvent[];
  /** Enriched narrative for downstream classifiers / AI */
  syntheticCorpus: string;
  logOnlyMode: boolean;
  parseConfidence: number;
  warnings: string[];
}

const LEVEL_RE = /^\s*\[(INFO|WARN|FAILED|ERROR|DEBUG)\]\s*(.*)$/i;
const ELAPSED_RE = /elapsed\s*(?:time)?\s*:?\s*(\d+(?:\.\d+)?)\s*(ms|s|sec|seconds?)?/i;
const TEST_OBJECT_RE =
  /findTestObject\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:object|element)\s*['"]([^'"]+)['"]|test object\s*['"]?([^'"\s]+)/i;
const KEYWORD_RE =
  /\b(WebUI|Mobile|WS|CustomKeywords)\.(\w+)\s*\(/i;
const RETRY_RE = /\b(retry|retrying|attempt\s+\d+|try\s+again)\b/i;

function parseLevel(line: string): { level: KatalonLogLevel; message: string } {
  const m = line.match(LEVEL_RE);
  if (m) {
    return { level: m[1].toUpperCase() as KatalonLogLevel, message: m[2].trim() };
  }
  if (/^\s*FAILED\b/i.test(line) || /\bStepFailedException\b/i.test(line)) {
    return { level: "FAILED", message: line.trim() };
  }
  if (/^\s*ERROR\b/i.test(line)) {
    return { level: "ERROR", message: line.trim() };
  }
  if (/^\s*WARN/i.test(line)) {
    return { level: "WARN", message: line.trim() };
  }
  return { level: "UNKNOWN", message: line.trim() };
}

function extractTestObject(message: string): string | undefined {
  const m = message.match(TEST_OBJECT_RE);
  return m?.[1] ?? m?.[2] ?? m?.[3];
}

function extractKeyword(message: string): string | undefined {
  const m = message.match(KEYWORD_RE);
  return m ? `${m[1]}.${m[2]}` : undefined;
}

function extractElapsedMs(message: string): number | undefined {
  const m = message.match(ELAPSED_RE);
  if (!m) return undefined;
  const n = Number(m[1]);
  const unit = (m[2] ?? "ms").toLowerCase();
  if (unit.startsWith("s")) return Math.round(n * 1000);
  return Math.round(n);
}

function detectPlatform(steps: KatalonLogStep[]): KatalonExecutionLogAnalysis["platform"] {
  const blob = steps.map((s) => s.message).join(" ");
  const hasWeb = /WebUI\./i.test(blob);
  const hasMobile = /Mobile\.|appium/i.test(blob);
  const hasApi = /WS\.|sendRequest|status code|response code/i.test(blob);
  if ([hasWeb, hasMobile, hasApi].filter(Boolean).length > 1) return "mixed";
  if (hasApi) return "api";
  if (hasMobile) return "mobile";
  if (hasWeb) return "web";
  return "unknown";
}

function detectPatterns(steps: KatalonLogStep[], fullText: string): DetectedLogPattern[] {
  const patterns: DetectedLogPattern[] = [];
  const add = (
    id: string,
    pattern: string,
    inference: string,
    failureType: FailureType,
    confidence: number
  ) => {
    if (!patterns.some((p) => p.id === id)) {
      patterns.push({ id, pattern, inference, failureType, confidence });
    }
  };

  const t = fullText.toLowerCase();

  if (/waitforelementvisible.*timeout|waiting for element.*timeout|timed out.*waitforelementvisible/i.test(t)) {
    add(
      "wait-visible-timeout",
      "waitForElementVisible timeout",
      "Element did not become visible within the Katalon wait threshold — timing issue, slow page load, or unstable locator.",
      "TIMING",
      0.88
    );
  }
  if (/waitforelementclickable.*timeout|timed out.*clickable/i.test(t)) {
    add(
      "wait-clickable-timeout",
      "waitForElementClickable timeout",
      "Element was visible but not clickable in time — overlay, animation, or late enablement.",
      "TIMING",
      0.85
    );
  }
  if (/stale element|staleelementreference/i.test(t)) {
    add(
      "stale-element",
      "Stale element reference",
      "DOM was refreshed after the element was located — dynamic frontend or flaky interaction.",
      "LOCATOR",
      0.9
    );
  }
  if (/not clickable at point|element click intercepted|obscured|overlay/i.test(t)) {
    add(
      "not-clickable-point",
      "Element not clickable at point",
      "Another element blocks interaction — popup, toast, spinner, or scroll position issue.",
      "LOCATOR",
      0.87
    );
  }
  if (/unable to click|unable to find|cannot find.*object|nosuchelement/i.test(t)) {
    add(
      "unable-interact",
      "Unable to interact with test object",
      "Katalon could not find or click the test object — wrong OR path, hidden element, or page state.",
      "LOCATOR",
      0.86
    );
  }
  if (/\b(500|502|503|504)\b|response code\s*(500|502|503)|internal server error/i.test(t)) {
    add(
      "http-5xx",
      "HTTP 5xx response",
      "Backend or API instability — environment or service failure.",
      "API",
      0.88
    );
  }
  if (/401|403|unauthorized|forbidden|invalid token/i.test(t)) {
    add(
      "auth-failure",
      "Authentication failure",
      "API or app rejected credentials — expired token or wrong test data.",
      "TEST_DATA",
      0.85
    );
  }
  if (/session.*expired|invalid session|browser.*closed|webdriver.*disconnect/i.test(t)) {
    add(
      "session-lost",
      "Browser/session lost",
      "WebDriver or Mobile session ended unexpectedly during the run.",
      "BROWSER_AUTOMATION",
      0.84
    );
  }
  if (/webui\.delay|delay\(\s*\d+/i.test(t)) {
    add(
      "fixed-delay",
      "WebUI.delay() used",
      "Static delay detected — prefer condition-based WebUI waits or project wait helpers.",
      "TIMING",
      0.75
    );
  }
  if (/verify.*failed|verification failed|does not match|assertion/i.test(t)) {
    add(
      "verify-failed",
      "Verification failed",
      "Assertion or WebUI.verify* did not match expected application state.",
      "ASSERTION",
      0.82
    );
  }
  if (
    /unable to get the url of the current window|cannot get.*url.*current window|no such window|target window already closed/i.test(
      t
    )
  ) {
    add(
      "window-url-missing",
      "Browser window / tab not available",
      "Katalon tried to use the current browser window but none was active — common after opening a new tab without switchToWindow.",
      "BROWSER_AUTOMATION",
      0.93
    );
  }
  if (/stepfailedexception|keyword.*failed/i.test(t)) {
    add(
      "step-failed",
      "Katalon StepFailedException",
      "A Katalon keyword step failed — inspect the failing keyword and test object in the log sequence.",
      "FRAMEWORK",
      0.8
    );
  }

  const retryLines = steps.filter((s) => s.isRetry || RETRY_RE.test(s.message));
  if (retryLines.length >= 1) {
    add(
      "retry-detected",
      "Retry attempts in log",
      "Test or keyword retried execution — may indicate flakiness or transient failure.",
      "TIMING",
      0.7
    );
  }

  return patterns;
}

function buildTimingAnalysis(steps: KatalonLogStep[], patterns: DetectedLogPattern[]): KatalonTimingAnalysis {
  const waitSteps = steps.filter((s) => s.isWait || /waitfor/i.test(s.message));
  const timeoutPatterns = patterns.filter((p) => p.id.includes("timeout"));
  const delayUsed = patterns.some((p) => p.id === "fixed-delay");
  const retryAttempts = steps.filter((s) => s.isRetry).length;

  const waitForVisibleTimeouts = patterns.filter((p) => p.id === "wait-visible-timeout").length;

  const repeatedWaits = waitSteps.length >= 3;
  const repeatedTimeouts = timeoutPatterns.length > 0 || waitForVisibleTimeouts > 0;
  const flakyTimingLikely =
    repeatedTimeouts || retryAttempts >= 1 || (repeatedWaits && delayUsed);

  let summary = "No strong timing anomaly detected from log sequence.";
  if (repeatedTimeouts) {
    summary = "Repeated wait/timeout messages suggest the UI was not ready in time.";
  } else if (delayUsed && repeatedWaits) {
    summary = "Fixed delays combined with multiple waits — likely race or slow rendering.";
  } else if (retryAttempts > 0) {
    summary = `${retryAttempts} retry indication(s) — timing or instability may be involved.`;
  }

  return {
    repeatedWaits,
    repeatedTimeouts,
    fixedDelaysUsed: delayUsed,
    retryAttempts,
    flakyTimingLikely,
    waitForVisibleTimeouts,
    summary,
  };
}

function patternsToSignals(patterns: DetectedLogPattern[]): ClassificationSignal[] {
  return patterns.map((p) => ({
    failureType: p.failureType,
    weight: p.confidence,
    reason: `${p.pattern}: ${p.inference}`,
  }));
}

function buildTimelineFromSteps(steps: KatalonLogStep[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let i = 0;
  const interesting = steps.filter(
    (s) =>
      s.level === "FAILED" ||
      s.level === "ERROR" ||
      s.isWait ||
      s.isRetry ||
      KEYWORD_RE.test(s.message)
  );
  const slice = interesting.length > 20 ? interesting.slice(-20) : interesting;
  for (const step of slice) {
    let kind: TimelineEvent["kind"] = "step";
    if (step.isWait) kind = "wait";
    if (step.isRetry) kind = "retry";
    if (step.level === "FAILED" || step.level === "ERROR") kind = "failure";
    if (/WS\.|sendRequest|response code/i.test(step.message)) kind = "api";
    if (/openBrowser|navigate|openUrl/i.test(step.message)) kind = "navigation";

    const label =
      step.testObject
        ? `${step.keyword ?? "step"} → ${step.testObject}`
        : step.message.slice(0, 120);

    events.push({
      id: `log-${++i}`,
      label,
      kind,
      timestampMs: step.elapsedMs,
      detail: step.level !== "INFO" ? step.level : undefined,
    });
  }
  return events;
}

function buildSyntheticCorpus(
  steps: KatalonLogStep[],
  patterns: DetectedLogPattern[],
  timing: KatalonTimingAnalysis,
  failingStep?: KatalonLogStep
): string {
  const lines: string[] = ["=== KATALON EXECUTION LOG ANALYSIS ==="];
  if (failingStep) {
    lines.push(`FAILING STEP: ${failingStep.message}`);
    if (failingStep.testObject) lines.push(`FAILED TEST OBJECT: ${failingStep.testObject}`);
    if (failingStep.keyword) lines.push(`FAILED KEYWORD: ${failingStep.keyword}`);
  }
  lines.push(`TIMING: ${timing.summary}`);
  for (const p of patterns) {
    lines.push(`PATTERN [${p.failureType}]: ${p.pattern} → ${p.inference}`);
  }
  lines.push("--- LOG EXCERPT ---");
  const tail = steps.slice(-40).map((s) => `[${s.level}] ${s.message}`);
  lines.push(...tail);
  return lines.join("\n");
}

/**
 * Parse Katalon Studio execution logs (.log, console output, report text) and infer failure patterns.
 * Works without stacktrace, screenshot, or HAR.
 */
export function analyzeKatalonExecutionLog(rawLog: string): KatalonExecutionLogAnalysis {
  const warnings: string[] = [];
  const lines = rawLog.split(/\r?\n/).filter((l) => l.trim().length > 0);

  if (!lines.length) {
    return {
      steps: [],
      platform: "unknown",
      timing: {
        repeatedWaits: false,
        repeatedTimeouts: false,
        fixedDelaysUsed: false,
        retryAttempts: 0,
        flakyTimingLikely: false,
        waitForVisibleTimeouts: 0,
        summary: "No log content to analyze.",
      },
      patterns: [],
      classificationSignals: [],
      timeline: [],
      syntheticCorpus: "",
      logOnlyMode: true,
      parseConfidence: 0,
      warnings: ["Empty log input."],
    };
  }

  const steps: KatalonLogStep[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const { level, message } = parseLevel(raw);
    const keyword = extractKeyword(message);
    const testObject = extractTestObject(message);
    const elapsedMs = extractElapsedMs(message);
    const isRetry = RETRY_RE.test(message);
    const isWait = /waitfor|waiting for|smart wait/i.test(message);

    steps.push({
      lineIndex: i,
      level,
      raw,
      message,
      keyword,
      testObject,
      elapsedMs,
      isRetry,
      isWait,
    });
  }

  const failedSteps = steps.filter(
    (s) =>
      s.level === "FAILED" ||
      s.level === "ERROR" ||
      /StepFailedException|FAILED:/i.test(s.message)
  );
  const failingStep = failedSteps[failedSteps.length - 1] ?? steps.find((s) => /FAILED/i.test(s.raw));

  let failedTestObject = failingStep?.testObject;
  if (!failedTestObject) {
    for (let i = steps.length - 1; i >= 0; i--) {
      const o = steps[i].testObject;
      if (o) {
        failedTestObject = o;
        break;
      }
    }
  }

  const fullText = rawLog;
  const exceptionLine = lines.find((l) =>
    /StepFailedException|Exception:|Caused by:/i.test(l)
  );
  const exceptionMessage = exceptionLine?.trim();

  const patterns = detectPatterns(steps, fullText);
  const timing = buildTimingAnalysis(steps, patterns);
  const classificationSignals = patternsToSignals(patterns);
  const timeline = buildTimelineFromSteps(steps);

  const platform = detectPlatform(steps);

  const hasKatalonMarkers =
    /WebUI\.|Mobile\.|findTestObject|com\.kms\.katalon|CustomKeywords/i.test(fullText);
  const hasFailureMarker =
    failedSteps.length > 0 || patterns.length > 0 || /FAILED|ERROR/i.test(fullText);

  let parseConfidence = 0.4;
  if (hasKatalonMarkers) parseConfidence += 0.25;
  if (failingStep) parseConfidence += 0.2;
  if (patterns.length > 0) parseConfidence += 0.15;
  if (failedTestObject) parseConfidence += 0.1;
  if (steps.length >= 5) parseConfidence += 0.05;
  parseConfidence = Math.min(0.95, parseConfidence);

  if (!hasFailureMarker) {
    warnings.push("No explicit FAILED/ERROR line found — inferences based on warning patterns only.");
    parseConfidence = Math.min(parseConfidence, 0.55);
  }
  if (!hasKatalonMarkers) {
    warnings.push("Log may not be from Katalon Studio — analysis confidence reduced.");
  }

  const syntheticCorpus = buildSyntheticCorpus(steps, patterns, timing, failingStep);

  return {
    steps,
    failingStep,
    failedTestObject,
    failedKeyword: failingStep?.keyword,
    exceptionMessage,
    platform,
    timing,
    patterns,
    classificationSignals,
    timeline,
    syntheticCorpus,
    logOnlyMode: true,
    parseConfidence,
    warnings,
  };
}

/** Merge all Katalon text inputs into one log stream for analysis. */
export function combineKatalonLogSources(parts: {
  logs?: string;
  katalonReport?: string;
  appiumLog?: string;
  stacktrace?: string;
}): string {
  return [parts.logs, parts.katalonReport, parts.appiumLog, parts.stacktrace]
    .filter((p) => p?.trim())
    .join("\n\n");
}
