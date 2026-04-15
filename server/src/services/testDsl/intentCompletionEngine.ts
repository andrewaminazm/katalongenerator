import type { TestDslStep } from "./universalStepNormalizer.js";
import { mapActionToSemanticIntent } from "./intentClassifier.js";
import { validateDsl } from "./validationLayer.js";
import { canonicalize } from "./universalStepNormalizer.js";
import { completeDslSafely } from "./dslCompletionEngine.js";

/**
 * Inserts conservative follow-up actions so flows remain executable (e.g. search → submit).
 * Does not add duplicate submits when the next step already advances the flow.
 */
export function runIntentCompletionOnDsl(input: {
  dsl: TestDslStep[];
  platform: "web" | "mobile";
}): { dsl: TestDslStep[]; warnings: string[]; errors: string[] } {
  const warnings: string[] = [];
  const completed = completeDslSafely({ dsl: input.dsl });
  warnings.push(...completed.warnings);

  if (completed.errors.length > 0) {
    return { dsl: completed.dsl, warnings, errors: completed.errors };
  }

  let dsl = completed.dsl;
  if (input.platform !== "web") {
    const v = validateDsl(dsl);
    return { dsl, warnings: [...warnings, ...v.warnings], errors: v.errors };
  }

  const out: TestDslStep[] = [];
  for (let i = 0; i < dsl.length; i++) {
    const step = dsl[i];
    out.push(step);

    if (step.action !== "type" || step.target !== "searchInput") continue;

    const next = dsl[i + 1];
    // Explicit submit already — do not add Enter.
    if (next && (next.action === "click" || next.action === "pressEnter")) {
      continue;
    }

    out.push({
      action: "pressEnter",
      intent: mapActionToSemanticIntent("pressEnter"),
      sourceConfidence: 72,
      raw: "[intent completion] press Enter after search",
      context: { intentCompletion: true },
    });
    warnings.push("Intent completion: inserted press Enter after search input (conservative).");
  }

  dsl = out;
  const v = validateDsl(dsl);
  return { dsl, warnings: [...warnings, ...v.warnings], errors: v.errors };
}

export function rebuildCanonicalSteps(dsl: TestDslStep[]): string[] {
  return dsl.map(canonicalize);
}
