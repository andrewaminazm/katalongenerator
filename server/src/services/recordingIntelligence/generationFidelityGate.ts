/**
 * Flexible validation before Groovy emit: recorded `context.selector` is authoritative.
 * Text/label mismatches against merged locator RHS must never block generation.
 * Execution uses selectors (and selectorByTestObjectLabel at compile time); merged lines are optional.
 */

import { parseLocatorLines } from "../katalonCompiler/locatorParser.js";
import type { TestDslStep } from "../testDsl/universalStepNormalizer.js";

export interface SelectorTraceFailure {
  stepIndex: number;
  target?: string;
  recordedSelector?: string;
  reason: string;
}

export interface LocatorTraceabilityReport {
  ok: boolean;
  failures: SelectorTraceFailure[];
  /** Non-blocking: e.g. locator RHS differs from recorded selector (selector still wins). */
  warnings?: string[];
  message?: string;
}

function rhsPreservesRecordedSelector(rhs: string, recordedSel: string): boolean {
  const r = rhs.trim();
  const s = recordedSel.trim();
  if (!s) return true;
  if (r.includes(s)) return true;
  const unquoted = s.replace(/^["'`]+|["'`]+$/g, "");
  if (unquoted && r.includes(unquoted)) return true;
  if (s.startsWith("#")) {
    const id = s.slice(1);
    if (r === id || r.includes(s)) return true;
  }
  return false;
}

/**
 * For lossless Web replay: steps with `context.selector` must have a TestObject target label
 * so compile can bind the recorded selector. RHS text mismatch vs recorded selector never fails.
 */
export function validateDslSelectorsTraceableInLocatorText(
  dsl: TestDslStep[],
  mergedLocatorsText: string
): LocatorTraceabilityReport {
  const parsed = parseLocatorLines(mergedLocatorsText);
  const byLabel = new Map<string, string>();
  for (const line of parsed) {
    byLabel.set(line.label, line.rhs);
  }

  const failures: SelectorTraceFailure[] = [];
  const warnings: string[] = [];

  dsl.forEach((step, stepIndex) => {
    if (step.action === "navigate") return;
    const sel = step.context?.selector;
    if (typeof sel !== "string" || !sel.trim()) return;
    const target = step.target?.trim();
    if (!target) {
      failures.push({
        stepIndex,
        recordedSelector: sel,
        reason: "Step has recorded selector but no TestObject target label",
      });
      return;
    }
    const rhs = byLabel.get(target);
    if (rhs && !rhsPreservesRecordedSelector(rhs, sel.trim())) {
      warnings.push(
        `Step ${stepIndex}: locator RHS for "${target}" does not substring-match recorded selector; execution uses recorded selector (authoritative).`
      );
    }
    // No failure when RHS is missing: compile maps target → selector via selectorByTestObjectLabel.
  });

  const ok = failures.length === 0;
  return {
    ok,
    failures,
    warnings: warnings.length ? warnings : undefined,
    message: ok
      ? undefined
      : `Selector binding failed: ${failures.length} step(s) with recorded selector lack a TestObject target label.`,
  };
}
