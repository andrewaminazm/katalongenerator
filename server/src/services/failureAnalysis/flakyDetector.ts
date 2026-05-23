import type { FlakyLevel } from "./types.js";
import type { LocatorAnalysis } from "./locatorFailureAnalyzer.js";
import type { TimingAnalysis } from "./timingIssueAnalyzer.js";

export interface FlakyAssessment {
  probability: number;
  level: FlakyLevel;
  indicators: string[];
  isLikelyRealBug: boolean;
}

export function detectFlakiness(
  corpus: string,
  timing: TimingAnalysis,
  locator: LocatorAnalysis,
  metadata?: { retryCount?: number }
): FlakyAssessment {
  const indicators: string[] = [];
  let score = 0;

  if (timing.raceConditionLikely) {
    indicators.push("Race condition / async UI timing");
    score += 0.35;
  }
  if (timing.fixedDelayUsed) {
    indicators.push("Fixed delay() instead of condition-based wait");
    score += 0.25;
  }
  if (locator.staleElement || locator.isDynamic) {
    indicators.push("Unstable or dynamic locator");
    score += 0.3;
  }
  if (/intermittent|flaky|sometimes|random|retry.*passed|passed on retry/i.test(corpus)) {
    indicators.push("Logs mention intermittent or retry success");
    score += 0.35;
  }
  if (metadata?.retryCount && metadata.retryCount > 0) {
    indicators.push(`Test had ${metadata.retryCount} retry(s)`);
    score += 0.15;
  }
  if (/network|timeout|503|502/i.test(corpus)) {
    indicators.push("Network/transient backend instability");
    score += 0.2;
  }

  const probability = Math.min(1, score);
  let level: FlakyLevel = "low";
  if (probability >= 0.65) level = "high";
  else if (probability >= 0.35) level = "medium";

  const isLikelyRealBug =
    probability < 0.4 &&
    (/assertion|expected.*actual|verify.*failed|500|auth|invalid user/i.test(corpus) ||
      (!timing.detected && !locator.detected));

  return { probability, level, indicators, isLikelyRealBug };
}
