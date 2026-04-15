import type { TestDslStep } from "./universalStepNormalizer.js";
import { resolveSemanticTarget } from "./targetResolver.js";
import { validateDsl } from "./validationLayer.js";

export interface CompletionResult {
  dsl: TestDslStep[];
  errors: string[];
  warnings: string[];
}

function inferTargetFromContext(step: TestDslStep, lastKnownTarget?: string): { target?: string; confidence: number } {
  // Only infer for non-destructive, unambiguous actions.
  if (
    step.action !== "type" &&
    step.action !== "click" &&
    step.action !== "select" &&
    step.action !== "upload"
  ) {
    return { confidence: 0 };
  }

  if (step.target && step.target.trim()) return { target: step.target, confidence: 100 };

  if (lastKnownTarget) {
    // Safe chaining (e.g., click Search → write andrew)
    return { target: lastKnownTarget, confidence: 80 };
  }

  // If raw exists, fall back to semantic naming (still low confidence because it may be value-like).
  if (step.raw && step.raw.trim().length > 0) {
    return { target: resolveSemanticTarget(step.raw), confidence: 60 };
  }

  return { confidence: 0 };
}

function inferValueFromRaw(step: TestDslStep): { value?: string; confidence: number } {
  if (step.action !== "type") return { confidence: 0 };
  const v = (step.value ?? "").trim();
  if (v) return { value: v, confidence: 100 };
  const raw = (step.raw ?? "").trim();
  if (!raw) return { confidence: 0 };

  // Heuristic: "write andrew" / "type andrew" → value = tail
  const m = raw.match(/^\s*(write|type|enter)\s+(.+)\s*$/i);
  if (m) {
    const tail = m[2].trim();
    // Avoid treating common field nouns as values (username/password/search/etc.)
    if (!/\b(field|input|box|textbox|username|password|email|search)\b/i.test(tail)) {
      return { value: tail, confidence: 80 };
    }
  }
  return { confidence: 0 };
}

/**
 * Runs after normalization detects missing fields.
 * Repairs steps with controlled inference and marks them as inferred in context.
 */
export function completeDslSafely(input: {
  dsl: TestDslStep[];
}): CompletionResult {
  const warnings: string[] = [];
  const out: TestDslStep[] = [];

  let lastKnownTarget: string | undefined;

  for (const s of input.dsl) {
    let step: TestDslStep = {
      ...s,
      sourceConfidence: s.sourceConfidence ?? 88,
      context: { ...(s.context ?? {}) },
    };

    const valInf = inferValueFromRaw(step);
    if (step.action === "type" && (!step.value || !step.value.trim()) && valInf.value) {
      step.value = valInf.value;
      step.context = { ...(step.context ?? {}), inferred: true, inferredValue: true, confidence: valInf.confidence };
      warnings.push(`Inferred type value from raw: "${step.raw}" → "${valInf.value}" (confidence ${valInf.confidence})`);
    }

    const tgtInf = inferTargetFromContext(step, lastKnownTarget);
    if (!step.target && tgtInf.target) {
      step.target = tgtInf.target;
      step.context = { ...(step.context ?? {}), inferred: true, inferredTarget: true, confidence: tgtInf.confidence };
      warnings.push(`Inferred target from context for "${step.raw}" → ${tgtInf.target} (confidence ${tgtInf.confidence})`);
    }

    // Update context memory
    if (step.target) lastKnownTarget = step.target;

    out.push(step);
  }

  const v = validateDsl(out);
  return { dsl: out, errors: v.errors, warnings: [...warnings, ...v.warnings] };
}

