import { autoFixGroovy } from "./autoFixEngine.js";
import { compileActions, type InternalOp } from "./actionCompiler.js";
import { parseLocatorLines, resolveLocators } from "./locatorParser.js";
import { parseAllSteps, parseStepLine } from "./stepParser.js";
import { assembleMobileScript, assembleWebScript } from "./scriptAssembler.js";
import { validateKatalonGroovy } from "./validationLayer.js";
import type { CompileKatalonInput, CompileKatalonResult } from "./types.js";
import { buildTestFlow } from "../testIntelligence/testFlowBuilder.js";
import { improveLocatorVarBases } from "../testIntelligence/namingEngine.js";

export const COMPILER_MODEL_ID = "katalon-compiler-v1";

export * from "./types.js";
export { scoreLocator, isLikelyDynamicId } from "./locatorScorer.js";
export {
  resolveLocators,
  parseLocatorLines,
  classifyRhs,
  buildResolvedLocatorFromRhs,
} from "./locatorParser.js";
export { convertPlaywrightRhsToKatalonSelector, isPlaywrightLocatorRhs } from "./playwrightToKatalon.js";
export { resolveLocatorWithFallbacks, extractSelectorFromHint } from "./locatorResolve.js";
export { parseStepLine, parseAllSteps } from "./stepParser.js";
export { compileActions } from "./actionCompiler.js";

function coalesceWebOpens(ops: InternalOp[], fallbackUrl?: string): InternalOp[] {
  if (ops.length === 0) return ops;
  const o: InternalOp[] = [...ops];
  if (o[0].kind === "navigate") {
    o[0] = { kind: "openBrowser", url: o[0].url };
  }
  if (o[0].kind === "openBrowser") {
    const u = o[0].url?.trim();
    if ((!u || u === "about:blank") && fallbackUrl?.trim()) {
      o[0] = { kind: "openBrowser", url: fallbackUrl.trim() };
    }
  }
  return o;
}

/**
 * Deterministic Katalon Groovy compiler — no LLM in this path.
 */
export function compileKatalonScript(input: CompileKatalonInput): CompileKatalonResult {
  const warnings: string[] = [];

  const lines = parseLocatorLines(input.locatorsText);
  let resolved = resolveLocators(lines, { pageUrl: input.url?.trim() });
  resolved = improveLocatorVarBases(resolved);

  const ti = buildTestFlow(input.steps, { platform: input.platform, defaultUrl: input.url?.trim() });
  warnings.push(...ti.warnings);

  // Use intelligent intents directly; only re-parse unknown raw lines through the legacy parser.
  const intents = ti.intents.map((i) => (i.kind === "unknown" ? parseStepLine(i.raw, input.platform) : i));

  const parallelSelectors =
    input.playwrightContextSelectors &&
    input.playwrightContextSelectors.length === intents.length
      ? input.playwrightContextSelectors
      : undefined;

  let { operations, warnings: w1, errors: compileErrors } = compileActions(intents, resolved, {
    platform: input.platform,
    defaultUrl: input.url?.trim(),
    parsedLines: lines,
    selectorByTestObjectLabel: input.selectorByTestObjectLabel,
    ...(parallelSelectors ? { playwrightContextSelectors: parallelSelectors } : {}),
  });
  warnings.push(...w1);

  if (compileErrors.length > 0) {
    return {
      code: "",
      model: COMPILER_MODEL_ID,
      warnings,
      validationErrors: compileErrors,
      validationStage: "compile",
    };
  }

  if (input.platform === "web") {
    operations = coalesceWebOpens(operations, input.url);
  }

  let raw =
    input.platform === "web"
      ? assembleWebScript(input, operations)
      : assembleMobileScript(input, operations);

  raw = autoFixGroovy(raw, input.platform);

  const v = validateKatalonGroovy(raw);
  warnings.push(...v.warnings);

  if (v.errors.length > 0) {
    return {
      code: "",
      model: COMPILER_MODEL_ID,
      warnings,
      validationErrors: v.errors,
      validationStage: "groovy",
    };
  }

  return {
    code: raw,
    model: COMPILER_MODEL_ID,
    warnings,
    validationErrors: [],
  };
}
