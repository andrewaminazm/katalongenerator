import type { AnyStepsInput } from "./formatUnifier.js";
import {
  universalStepNormalizer,
  finalizeDslPipeline,
  type NormalizeResult,
  type TestDslStep,
} from "./universalStepNormalizer.js";
import { runIntentCompletionOnDsl, rebuildCanonicalSteps } from "./intentCompletionEngine.js";

/**
 * Universal Test Step Intelligence — single QA-compiler entry point.
 *
 * Pipeline (DSL stages):
 * 1. Format unifier (inside universalStepNormalizer)
 * 2. Intent classification + target binding + semantic naming
 * 3. Step repair (pre-validation)
 * 4. Validation
 * 5. Intent completion (field inference + search submit, web)
 *
 * Downstream `/api/generate` then runs: Groovy codegen → dependency enforcement →
 * execution-state optimizer → text optimizer → Groovy lint.
 */
export function runUniversalTestStepIntelligence(params: {
  input: AnyStepsInput;
  platform: "web" | "mobile";
}): NormalizeResult {
  const base = universalStepNormalizer(params);
  if (base.errors.length > 0) {
    return base;
  }

  const completed = runIntentCompletionOnDsl({
    dsl: base.dsl,
    platform: params.platform,
  });

  if (completed.errors.length > 0) {
    return {
      ...base,
      dsl: completed.dsl,
      errors: completed.errors,
      warnings: [...base.warnings, ...completed.warnings],
      canonicalSteps: rebuildCanonicalSteps(completed.dsl),
    };
  }

  return {
    dsl: completed.dsl,
    errors: [],
    warnings: [...base.warnings, ...completed.warnings],
    canonicalSteps: rebuildCanonicalSteps(completed.dsl),
  };
}

/**
 * Playwright action parser output → repair → validation → intent completion (skips NLP on raw strings).
 */
export function runUniversalTestStepIntelligenceFromDsl(params: {
  dsl: TestDslStep[];
  platform: "web" | "mobile";
  /** When true, skip intent-completion (no inserted Enter/submit) so step count matches the trace. */
  preserveRecordingFidelity?: boolean;
}): NormalizeResult {
  const base = finalizeDslPipeline(params.dsl);
  if (base.errors.length > 0) {
    return base;
  }

  if (params.preserveRecordingFidelity === true) {
    return {
      dsl: base.dsl,
      errors: [],
      warnings: base.warnings,
      canonicalSteps: rebuildCanonicalSteps(base.dsl),
    };
  }

  const completed = runIntentCompletionOnDsl({
    dsl: base.dsl,
    platform: params.platform,
  });

  if (completed.errors.length > 0) {
    return {
      ...base,
      dsl: completed.dsl,
      errors: completed.errors,
      warnings: [...base.warnings, ...completed.warnings],
      canonicalSteps: rebuildCanonicalSteps(completed.dsl),
    };
  }

  return {
    dsl: completed.dsl,
    errors: [],
    warnings: [...base.warnings, ...completed.warnings],
    canonicalSteps: rebuildCanonicalSteps(completed.dsl),
  };
}
