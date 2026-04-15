import type { TestDslStep } from "./universalStepNormalizer.js";
import { detectUrl } from "./intentClassifier.js";

export interface DslValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateDsl(steps: TestDslStep[]): DslValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  steps.forEach((s, idx) => {
    const n = idx + 1;
    if (!s.action) errors.push(`Step ${n}: missing action`);
    if (s.action === "pressEnter") return;
    if (s.action === "keyAction") {
      if (!s.target?.trim()) warnings.push(`Step ${n}: keyAction missing target`);
      if (!(s.value ?? "").trim()) warnings.push(`Step ${n}: keyAction missing key`);
      return;
    }
    if (s.action === "click" && !s.target) warnings.push(`Step ${n}: click missing target (repaired placeholder may be needed)`);
    if ((s.action === "check" || s.action === "uncheck") && !s.target?.trim()) {
      warnings.push(`Step ${n}: ${s.action} missing target`);
    }
    if (s.action === "type") {
      if (!s.value || !s.value.trim()) warnings.push(`Step ${n}: type missing value (placeholder may be used)`);
      if (!s.target) warnings.push(`Step ${n}: type missing target (chaining may apply)`);
    }
    if (s.action === "navigate") {
      const raw = (s.value ?? "").trim();
      if (raw === "about:blank") return;
      const u = raw ? detectUrl(raw) : undefined;
      if (!u) warnings.push(`Step ${n}: navigate missing/invalid URL (about:blank fallback allowed)`);
    }
    if (s.action === "wait") {
      const sec = typeof s.value === "string" ? parseInt(s.value, 10) : NaN;
      if (!Number.isFinite(sec) || sec <= 0) warnings.push(`Step ${n}: wait missing/invalid seconds; defaulting to 10`);
    }
    // Block unsafe: value used as target (classic bug class).
    if (s.target && s.value && s.target === s.value) {
      errors.push(`Step ${n}: target must not equal value (value/locator confusion)`);
    }
  });

  return { errors, warnings };
}

