import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RefactorIssue } from "./types.js";

export function analyzeWaits(scripts: LoadedScript[]): {
  issues: RefactorIssue[];
  stabilityScore: number;
} {
  const issues: RefactorIssue[] = [];
  let threadSleepCount = 0;
  let missingWaitHints = 0;

  for (const s of scripts) {
    const sleeps = (s.content.match(/\bThread\.sleep\s*\(/gi) ?? []).length;
    threadSleepCount += sleeps;
    if (sleeps > 0) {
      issues.push({
        id: `wait-thread-${s.scriptPath}`,
        category: "wait",
        severity: sleeps > 2 ? "high" : "medium",
        confidence: 0.95,
        impactScore: 70,
        fixComplexity: "low",
        title: `Thread.sleep in ${s.logicalPath}`,
        detail: `Found ${sleeps} Thread.sleep call(s) — unstable in Katalon parallel runs.`,
        whyItMatters: "Hard sleeps cause flakiness and slow suites; Katalon WebUI.delay or explicit waits scale better.",
        affectedFiles: [s.scriptPath],
        suggestedSolution: "Replace with WebUI.delay(seconds) or waitForElementVisible on a stable OR object.",
        beforeExample: "Thread.sleep(3000)",
        afterExample: "WebUI.delay(3)\n// or WebUI.waitForElementVisible(findTestObject('...'), 10)",
      });
    }

    const clicks = (s.content.match(/\bWebUI\.click\s*\(/gi) ?? []).length;
    const waits = (s.content.match(/\bWebUI\.waitFor\w+\s*\(/gi) ?? []).length;
    if (clicks >= 3 && waits === 0) {
      missingWaitHints += 1;
      issues.push({
        id: `wait-missing-${s.scriptPath}`,
        category: "wait",
        severity: "medium",
        confidence: 0.75,
        impactScore: 55,
        fixComplexity: "medium",
        title: `Few explicit waits after actions in ${s.logicalPath}`,
        detail: `${clicks} click/action calls with no WebUI.waitFor* detected nearby.`,
        whyItMatters: "Actions without synchronization are a top cause of intermittent failures.",
        affectedFiles: [s.scriptPath],
        suggestedSolution: "Add waitForElementVisible or waitForElementClickable after navigation and clicks.",
      });
    }
  }

  if (threadSleepCount >= 5) {
    issues.push({
      id: "wait-global-thread",
      category: "wait",
      severity: "critical",
      confidence: 0.9,
      impactScore: 85,
      fixComplexity: "medium",
      title: `${threadSleepCount} Thread.sleep usages project-wide`,
      detail: "Centralize timing in a WaitHelper custom keyword for consistent policy.",
      whyItMatters: "Distributed sleeps are hard to tune when environments differ in speed.",
      affectedFiles: [],
      suggestedSolution: "Create common.WaitHelper.pause(seconds) and replace Thread.sleep calls incrementally.",
      beforeExample: "Thread.sleep(5000)",
      afterExample: "CustomKeywords.'common.WaitHelper'.pause(5)",
    });
  }

  const penalty = threadSleepCount * 4 + missingWaitHints * 3;
  const stabilityScore = Math.max(0, Math.min(100, 100 - penalty));

  return { issues, stabilityScore };
}
