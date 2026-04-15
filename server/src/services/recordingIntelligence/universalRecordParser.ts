/**
 * Universal entry: normalize recordings from supported formats into UniversalRecordStep[].
 */

import { parsePlaywrightScriptToDsl, type PlaywrightParseOptions } from "../playwrightActionParser.js";
import type { TestDslStep } from "../testDsl/universalStepNormalizer.js";
import type { UniversalParseResult, UniversalRecordAction, UniversalRecordStep, UniversalRecordSource } from "./universalRecordTypes.js";

function dslActionToUniversal(a: TestDslStep["action"]): UniversalRecordAction {
  switch (a) {
    case "navigate":
      return "navigate";
    case "click":
    case "check":
    case "uncheck":
      return "click";
    case "type":
      return "fill";
    case "keyAction":
    case "pressEnter":
      return "press";
    case "wait":
      return "wait";
    case "verify":
      return "wait";
    default:
      return "unknown";
  }
}

function mapDslToUniversal(step: TestDslStep, sequence: number, source: UniversalRecordSource): UniversalRecordStep {
  const selector = typeof step.context?.selector === "string" ? step.context.selector : undefined;
  return {
    sequence,
    action: dslActionToUniversal(step.action),
    target: step.target,
    value: step.value,
    selector,
    source,
    platform: "web",
    confidence: step.sourceConfidence >= 80 ? "high" : step.sourceConfidence >= 50 ? "medium" : "low",
    needsReview: Boolean(step.context?.needsClarification),
    raw: step.raw,
  };
}

/** Playwright script → universal record steps (partial parse still maps parsed lines; errors list unparsed Playwright-looking lines). */
export function parsePlaywrightToUniversalRecord(
  script: string,
  parseOptions?: PlaywrightParseOptions
): UniversalParseResult {
  const r = parsePlaywrightScriptToDsl(script, parseOptions);
  if (r.dsl.length === 0) {
    return { steps: [], warnings: r.warnings, errors: r.errors };
  }
  const steps = r.dsl.map((s, i) => mapDslToUniversal(s, i + 1, "playwright"));
  return { steps, warnings: r.warnings, errors: r.errors };
}

/** Manual / numbered list → one step per non-empty line (low confidence until DSL normalizer runs). */
export function parseManualStepLog(lines: string[] | string): UniversalParseResult {
  const arr = Array.isArray(lines) ? lines : lines.split(/\r?\n/);
  const steps: UniversalRecordStep[] = [];
  let seq = 0;
  for (const raw of arr) {
    const t = raw.trim();
    if (!t) continue;
    const m = t.match(/^\s*(?:\d+\s*[-.)]|[-*])\s*(.+)$/);
    const line = (m ? m[1] : t).trim();
    if (!line) continue;
    seq++;
    steps.push({
      sequence: seq,
      action: "click",
      value: line,
      source: "manual",
      platform: "unknown",
      confidence: "medium",
      needsReview: true,
      raw: line,
    });
  }
  return { steps, warnings: [], errors: [] };
}

/** Selenium IDE JSON (minimal). */
export function parseSeleniumIdeExport(jsonText: string): UniversalParseResult {
  try {
    const j = JSON.parse(jsonText) as { tests?: Array<{ commands?: Array<{ command: string; target?: string; value?: string }> }> };
    const cmds = j.tests?.[0]?.commands;
    if (!Array.isArray(cmds)) {
      return { steps: [], warnings: ["Selenium IDE: no tests[0].commands — paste a full JSON export"], errors: [] };
    }
    const steps: UniversalRecordStep[] = [];
    let seq = 0;
    for (const c of cmds) {
      const cmd = (c.command ?? "").toLowerCase();
      seq++;
      if (cmd === "open" || cmd === "navigate") {
        steps.push({
          sequence: seq,
          action: "navigate",
          value: c.value ?? c.target ?? "",
          selector: c.target,
          source: "selenium",
          platform: "web",
          confidence: "high",
        });
        continue;
      }
      if (cmd === "click" || cmd === "clickat") {
        steps.push({
          sequence: seq,
          action: "click",
          selector: c.target,
          source: "selenium",
          platform: "web",
          confidence: "high",
        });
        continue;
      }
      if (cmd === "type" || cmd === "sendkeys" || cmd === "editcontent") {
        steps.push({
          sequence: seq,
          action: "fill",
          value: c.value ?? "",
          selector: c.target,
          source: "selenium",
          platform: "web",
          confidence: "high",
        });
        continue;
      }
      steps.push({
        sequence: seq,
        action: "unknown",
        selector: c.target,
        value: c.value,
        source: "selenium",
        platform: "web",
        confidence: "low",
        needsReview: true,
        raw: JSON.stringify(c),
      });
    }
    return { steps, warnings: [], errors: [] };
  } catch {
    return { steps: [], warnings: [], errors: ["Selenium IDE: invalid JSON"] };
  }
}

function mapAppiumVerbToAction(cmd: string): UniversalRecordAction {
  const c = cmd.toLowerCase();
  if (c.includes("click") || c === "tap") return "click";
  if (c.includes("send") || c.includes("type") || c.includes("input") || c === "keys") return "fill";
  if (c.includes("navigate") || c === "get" || c === "open") return "navigate";
  if (c.includes("wait")) return "wait";
  if (c.includes("scroll") || c === "swipe") return "scroll";
  return "unknown";
}

/**
 * Minimal Appium-style JSON: `{ "actions": [ { "action", "selector", "value" } ] }`.
 * Unknown verbs → `unknown` + needsReview (never dropped).
 */
export function parseAppiumRecorderJson(jsonText: string): UniversalParseResult {
  try {
    const j = JSON.parse(jsonText) as {
      actions?: Array<{ action?: string; selector?: string; value?: string; target?: string }>;
    };
    const acts = j.actions;
    if (!Array.isArray(acts)) {
      return {
        steps: [],
        warnings: ['Appium JSON: expected top-level "actions" array'],
        errors: [],
      };
    }
    const steps: UniversalRecordStep[] = [];
    let seq = 0;
    for (const a of acts) {
      seq++;
      const cmd = String(a.action ?? "unknown");
      const mapped = mapAppiumVerbToAction(cmd);
      const selector = a.selector ?? a.target;
      steps.push({
        sequence: seq,
        action: mapped,
        selector,
        value: a.value,
        source: "appium",
        platform: "mobile",
        confidence: mapped === "unknown" ? "low" : "medium",
        needsReview: mapped === "unknown",
        raw: JSON.stringify(a),
      });
    }
    return { steps, warnings: [], errors: [] };
  } catch {
    return { steps: [], warnings: [], errors: ["Appium: invalid JSON"] };
  }
}
