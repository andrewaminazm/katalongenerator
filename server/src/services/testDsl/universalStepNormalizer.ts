import { unifyToRawStepLines, type AnyStepsInput } from "./formatUnifier.js";
import {
  classifyIntent,
  type DslAction,
  detectUrl,
  inferKnownSiteUrl,
  mapActionToSemanticIntent,
} from "./intentClassifier.js";
import { bindValues } from "./valueBindingEngine.js";
import { resolveSemanticTarget } from "./targetResolver.js";
import { validateDsl } from "./validationLayer.js";
import { repairStepsBeforeValidation } from "./stepRepairEngine.js";

/** Canonical DSL step — QA compiler output (not user-shaped). */
export interface TestDslStep {
  action: DslAction;
  target?: string;
  value?: string;
  context?: Record<string, unknown>;
  /** navigation | interaction | input | validation | system */
  intent?: string;
  /** 0–100: how confident we are this step reflects user intent */
  sourceConfidence: number;
  /** For debugging / traceability */
  raw?: string;
}

export interface NormalizeResult {
  dsl: TestDslStep[];
  errors: string[];
  warnings: string[];
  canonicalSteps: string[];
}

function baseConfidenceForAction(action: DslAction): number {
  switch (action) {
    case "navigate":
    case "wait":
    case "pressEnter":
    case "keyAction":
      return 95;
    case "click":
    case "check":
    case "uncheck":
    case "type":
    case "verify":
      return 90;
    default:
      return 88;
  }
}

function applyConfidence(step: TestDslStep): TestDslStep {
  let c = step.sourceConfidence ?? baseConfidenceForAction(step.action);
  const ctx = step.context ?? {};
  if (ctx.repaired || ctx.inferred) c = Math.min(c, 78);
  if (ctx.needsClarification) c = Math.min(c, 45);
  if (typeof ctx.confidence === "number") c = Math.min(c, ctx.confidence as number);
  return { ...step, sourceConfidence: Math.max(0, Math.min(100, Math.round(c))) };
}

export function canonicalize(step: TestDslStep): string {
  switch (step.action) {
    case "navigate":
      return `navigate ${step.value ?? ""}`.trim();
    case "click":
      return `click ${step.target ?? ""}`.trim();
    case "type":
      return `type "${step.value ?? ""}" ${step.target ?? ""}`.trim();
    case "verify":
      return step.target
        ? `verify ${step.target} "${step.value ?? ""}"`.trim()
        : `verify "${step.value ?? ""}"`.trim();
    case "wait":
      return `wait ${step.value ?? "10"}s`;
    case "select":
      return `select "${step.value ?? ""}" ${step.target ?? ""}`.trim();
    case "upload":
      return `upload "${step.value ?? ""}" ${step.target ?? ""}`.trim();
    case "pressEnter":
      return "press enter";
    case "keyAction": {
      const k = (step.value ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      return `keyAction "${k}" ${step.target ?? ""}`.trim();
    }
    case "check":
      return `check ${step.target ?? ""}`.trim();
    case "uncheck":
      return `uncheck ${step.target ?? ""}`.trim();
    default:
      return step.raw ?? "unknown";
  }
}

export function universalStepNormalizer(params: {
  input: AnyStepsInput;
  platform: "web" | "mobile";
}): NormalizeResult {
  const rawLines = unifyToRawStepLines(params.input);
  const dsl: TestDslStep[] = [];
  const warnings: string[] = [];
  let lastTarget: string | undefined;

  for (const raw of rawLines) {
    const c = classifyIntent(raw);
    if (c.action === "unknown") {
      const inferredUrl = inferKnownSiteUrl(raw);
      if (inferredUrl) {
        dsl.push(
          applyConfidence({
            action: "navigate",
            value: inferredUrl,
            intent: mapActionToSemanticIntent("navigate"),
            sourceConfidence: 72,
            context: { inferredNavigate: true },
            raw,
          })
        );
        continue;
      }
      const searchLine = raw.match(/^\s*search\s+(.+)$/i);
      if (searchLine && !/\b(field|button|box|bar)\b/i.test(raw.toLowerCase())) {
        const query = searchLine[1].trim();
        const t = resolveSemanticTarget("search");
        dsl.push(
          applyConfidence({
            action: "type",
            target: t,
            value: query,
            intent: mapActionToSemanticIntent("type"),
            sourceConfidence: 80,
            context: { inferredSearchQuery: true },
            raw,
          })
        );
        lastTarget = t;
        continue;
      }
      dsl.push(
        applyConfidence({
          action: "verify",
          value: "",
          intent: "validation",
          sourceConfidence: 35,
          context: { needsClarification: true, raw },
          raw,
        })
      );
      warnings.push(`Unclear step (needs clarification): ${raw}`);
      continue;
    }

    const sem = mapActionToSemanticIntent(c.action);
    const parts = bindValues(c.action, raw);

    if (c.action === "navigate") {
      const u = parts.url ?? detectUrl(raw) ?? inferKnownSiteUrl(raw);
      dsl.push(
        applyConfidence({
          action: "navigate",
          value: u ?? "about:blank",
          intent: sem,
          sourceConfidence: baseConfidenceForAction("navigate"),
          raw,
        })
      );
      continue;
    }

    if (c.action === "wait") {
      dsl.push(
        applyConfidence({
          action: "wait",
          value: String(parts.seconds ?? 10),
          intent: sem,
          sourceConfidence: baseConfidenceForAction("wait"),
          raw,
        })
      );
      continue;
    }

    if (c.action === "pressEnter") {
      dsl.push(
        applyConfidence({
          action: "pressEnter",
          intent: sem,
          sourceConfidence: baseConfidenceForAction("pressEnter"),
          raw,
        })
      );
      continue;
    }

    if (c.action === "keyAction") {
      const key = (parts.value ?? "").trim();
      const targetName = parts.targetHint
        ? resolveSemanticTarget(parts.targetHint)
        : resolveSemanticTarget(lastTarget ?? "el");
      dsl.push(
        applyConfidence({
          action: "keyAction",
          target: targetName,
          value: key,
          intent: sem,
          sourceConfidence: baseConfidenceForAction("keyAction"),
          raw,
          context: { key },
        })
      );
      continue;
    }

    if (c.action === "type") {
      const isSearchQueryLine = /^\s*search\s+/i.test(raw) && !/\b(field|button|box|bar)\b/i.test(raw.toLowerCase());
      let targetName = parts.targetHint ? resolveSemanticTarget(parts.targetHint) : undefined;
      let value = parts.value ?? "";
      if (isSearchQueryLine) {
        const m = raw.match(/^\s*search\s+(.+)$/i);
        if (m) {
          value = m[1].trim().replace(/^for\s+/i, "");
          targetName = resolveSemanticTarget("search");
        }
      }
      const chained = targetName ?? lastTarget;
      if (!targetName && lastTarget) {
        warnings.push(`Chained type value to last target (${lastTarget}) for: ${raw}`);
      }
      dsl.push(
        applyConfidence({
          action: "type",
          target: chained,
          value,
          intent: sem,
          sourceConfidence: baseConfidenceForAction("type"),
          raw,
        })
      );
      lastTarget = chained;
      continue;
    }

    if (c.action === "click") {
      const targetName = resolveSemanticTarget(parts.targetHint ?? raw);
      dsl.push(
        applyConfidence({
          action: "click",
          target: targetName,
          intent: sem,
          sourceConfidence: baseConfidenceForAction("click"),
          raw,
        })
      );
      lastTarget = targetName;
      continue;
    }

    if (c.action === "verify") {
      const v = (parts.value ?? "").trim();
      dsl.push(
        applyConfidence({
          action: "verify",
          value: v,
          intent: sem,
          sourceConfidence: baseConfidenceForAction("verify"),
          raw,
        })
      );
      continue;
    }

    if (c.action === "select" || c.action === "upload") {
      const targetName = resolveSemanticTarget(parts.targetHint ?? raw);
      dsl.push(
        applyConfidence({
          action: c.action,
          target: targetName,
          value: parts.value ?? "",
          intent: sem,
          sourceConfidence: baseConfidenceForAction(c.action),
          raw,
        })
      );
      lastTarget = targetName;
      continue;
    }
  }

  const repaired = repairStepsBeforeValidation({ dsl });
  const withConfidence = repaired.dsl.map((s) => applyConfidence(s));
  const v = validateDsl(withConfidence);
  const canonicalSteps = withConfidence.map(canonicalize);
  return {
    dsl: withConfidence,
    errors: v.errors,
    warnings: [...warnings, ...repaired.warnings, ...v.warnings],
    canonicalSteps,
  };
}

/**
 * Run repair + validation + canonicalization on pre-built DSL (e.g. from Playwright action parser).
 * Does not run NLP classification.
 */
export function finalizeDslPipeline(dsl: TestDslStep[]): NormalizeResult {
  const repaired = repairStepsBeforeValidation({ dsl });
  const withConfidence = repaired.dsl.map((s) => applyConfidence(s));
  const v = validateDsl(withConfidence);
  const canonicalSteps = withConfidence.map(canonicalize);
  return {
    dsl: withConfidence,
    errors: v.errors,
    warnings: [...repaired.warnings, ...v.warnings],
    canonicalSteps,
  };
}
