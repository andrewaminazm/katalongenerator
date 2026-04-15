import type { TestDslStep } from "./universalStepNormalizer.js";
import { resolveSemanticTarget } from "./targetResolver.js";
import { detectUrl } from "./intentClassifier.js";

export interface RepairResult {
  dsl: TestDslStep[];
  warnings: string[];
}

function extractQuoted(s: string): string | undefined {
  const m = s.match(/["'“”]([^"'“”]+)["'“”]/);
  return m ? m[1].trim() : undefined;
}

function repairType(step: TestDslStep, lastTarget?: string): { step: TestDslStep; lastTarget?: string; warnings: string[] } {
  const warnings: string[] = [];
  const out: TestDslStep = {
    ...step,
    sourceConfidence: step.sourceConfidence ?? 88,
    context: { ...(step.context ?? {}) },
  };

  // VALUE
  const val = (out.value ?? "").trim();
  if (!val) {
    const raw = (out.raw ?? "").trim();
    const q = extractQuoted(raw);
    let inferred: string | undefined = q;
    if (!inferred) {
      const m = raw.match(/^\s*(write|type|enter|input)\s+(.+)\s*$/i);
      if (m) {
        const tail = m[2].trim();
        // Avoid treating common field nouns as values
        if (!/\b(field|input|box|textbox|username|password|email|search)\b/i.test(tail)) {
          inferred = tail;
        }
      }
    }
    if (inferred) {
      out.value = inferred;
      out.context = { ...(out.context ?? {}), repaired: true, confidence: 0.7, repairedValue: true };
      warnings.push(`Repaired missing type value from raw: "${raw}" → "${inferred}"`);
    } else {
      // No-fail mode: keep pipeline moving but mark as requires input.
      out.value = "__MISSING__";
      out.context = { ...(out.context ?? {}), repaired: true, confidence: 0.6, requiresInput: true, repairedValue: false };
      warnings.push(`Type step missing value — inserted placeholder __MISSING__ for: ${out.raw ?? ""}`);
    }
  }

  // TARGET
  const tgt = (out.target ?? "").trim();
  if (!tgt) {
    if (lastTarget) {
      out.target = lastTarget;
      out.context = { ...(out.context ?? {}), repaired: true, confidence: 0.7, repairedTarget: true };
      warnings.push(`Repaired missing type target from context: ${lastTarget} for "${out.raw ?? ""}"`);
      return { step: out, lastTarget, warnings };
    }
    // Infer from raw hint as a last resort (low confidence)
    if (out.raw && out.raw.trim()) {
      out.target = resolveSemanticTarget(out.raw);
      out.context = { ...(out.context ?? {}), repaired: true, confidence: 0.6, repairedTarget: true };
      warnings.push(`Repaired missing type target from raw hint: ${out.target} for "${out.raw}"`);
      return { step: out, lastTarget: out.target, warnings };
    }
  }

  return { step: out, lastTarget: out.target ?? lastTarget, warnings };
}

function repairClick(step: TestDslStep, lastTarget?: string): { step: TestDslStep; lastTarget?: string; warnings: string[] } {
  const warnings: string[] = [];
  const out: TestDslStep = {
    ...step,
    sourceConfidence: step.sourceConfidence ?? 88,
    context: { ...(step.context ?? {}) },
  };
  const tgt = (out.target ?? "").trim();
  if (!tgt) {
    if (out.raw && out.raw.trim()) {
      out.target = resolveSemanticTarget(out.raw);
      out.context = { ...(out.context ?? {}), repaired: true, confidence: 0.8, repairedTarget: true };
      warnings.push(`Repaired missing click target: ${out.target} for "${out.raw}"`);
      return { step: out, lastTarget: out.target, warnings };
    }
    if (lastTarget) {
      out.target = lastTarget;
      out.context = { ...(out.context ?? {}), repaired: true, confidence: 0.6, repairedTarget: true };
      warnings.push(`Repaired missing click target from context: ${lastTarget}`);
      return { step: out, lastTarget, warnings };
    }
  }
  return { step: out, lastTarget: out.target ?? lastTarget, warnings };
}

function repairNavigate(step: TestDslStep): { step: TestDslStep; warnings: string[] } {
  const warnings: string[] = [];
  const out: TestDslStep = {
    ...step,
    sourceConfidence: step.sourceConfidence ?? 95,
    context: { ...(step.context ?? {}) },
  };
  const raw = (out.value ?? "").trim();
  if (!raw) {
    out.value = "about:blank";
    out.context = { ...(out.context ?? {}), repaired: true, confidence: 0.9 };
    return { step: out, warnings };
  }
  const u = detectUrl(raw);
  if (u) {
    out.value = u;
    return { step: out, warnings };
  }
  // No-fail: treat as about:blank if malformed (don’t guess a URL)
  out.value = "about:blank";
  out.context = { ...(out.context ?? {}), repaired: true, confidence: 0.6, requiresClarification: true };
  warnings.push(`Navigate value was not a URL — replaced with about:blank for: ${out.raw ?? raw}`);
  return { step: out, warnings };
}

/**
 * PRE-VALIDATION REPAIR LAYER.
 * Repairs incomplete fields deterministically and marks them as repaired with confidence.
 * Never throws; returns warnings and a repaired DSL.
 */
export function repairStepsBeforeValidation(input: { dsl: TestDslStep[] }): RepairResult {
  const warnings: string[] = [];
  const out: TestDslStep[] = [];
  let lastTarget: string | undefined;

  for (const s of input.dsl) {
    if (s.action === "type") {
      const r = repairType(s, lastTarget);
      out.push(r.step);
      lastTarget = r.lastTarget;
      warnings.push(...r.warnings);
      continue;
    }
    if (s.action === "click") {
      const r = repairClick(s, lastTarget);
      out.push(r.step);
      lastTarget = r.lastTarget;
      warnings.push(...r.warnings);
      continue;
    }
    if (s.action === "navigate") {
      const r = repairNavigate(s);
      out.push(r.step);
      warnings.push(...r.warnings);
      continue;
    }

    if (s.action === "pressEnter" || s.action === "keyAction") {
      out.push({ ...s, sourceConfidence: s.sourceConfidence ?? 95 });
      continue;
    }

    // Pass-through; update context memory if applicable.
    out.push({ ...s, sourceConfidence: s.sourceConfidence ?? 88 });
    if (s.target) lastTarget = s.target;
  }

  return { dsl: out, warnings };
}

