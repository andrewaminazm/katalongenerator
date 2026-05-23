export interface TimingAnalysis {
  detected: boolean;
  problem: string;
  recommendation: string;
  raceConditionLikely: boolean;
  fixedDelayUsed: boolean;
  missingWait: boolean;
  score: number;
}

export function analyzeTimingIssue(corpus: string): TimingAnalysis {
  const c = corpus.toLowerCase();
  const detected =
    /timeout|timed out|waiting|wait.*failed|slow|race|async|animation|delay\(|thread\.sleep/i.test(c);

  if (!detected) {
    return {
      detected: false,
      problem: "",
      recommendation: "",
      raceConditionLikely: false,
      fixedDelayUsed: false,
      missingWait: false,
      score: 0,
    };
  }

  const fixedDelayUsed = /delay\(|thread\.sleep|sleep\(/i.test(c);
  const missingWait = /timeoutexception|waiting for element|wait.*failed/i.test(c) && !/waitfor/i.test(c);
  const raceConditionLikely =
    /race|async|animation|spinner|loading|render/i.test(c) || (fixedDelayUsed && missingWait);

  let problem = "The test did not wait long enough for the application state required for the next action.";
  if (raceConditionLikely) {
    problem =
      "A race condition is likely: UI updated asynchronously (spinner, animation, or late render) while the test proceeded.";
  } else if (fixedDelayUsed) {
    problem = "Fixed delay() was used but the page took longer than expected to become ready.";
  }

  const recommendation = fixedDelayUsed
    ? "Replace WebUI.delay() with Katalon built-in waits: WebUI.waitForElementVisible / waitForElementClickable, or your project's Custom Keyword wait helper."
    : "Add WebUI.waitForElementVisible or waitForElementClickable on the failing test object before click/type; avoid hard-coded delay().";

  return {
    detected: true,
    problem,
    recommendation,
    raceConditionLikely,
    fixedDelayUsed,
    missingWait,
    score: raceConditionLikely ? 0.88 : 0.72,
  };
}
