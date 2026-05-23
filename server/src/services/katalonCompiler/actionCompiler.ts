import { buildResolvedLocatorFromRhs } from "./locatorParser.js";
import {
  buildFallbackResolvedLocator,
  extractSelectorFromHint,
  resolveLocatorWithFallbacks,
  type LocatorMatchIntent,
} from "./locatorResolve.js";
import { StateTracker } from "./stateTracker.js";
import type { ParsedKeywordClass } from "../projectIntelligence/types.js";
import { extractKeywordArgsFromStep } from "../projectIntelligence/stepReferenceExtractor.js";
import { resolveUrlParameterValue } from "../projectIntelligence/keywordParser.js";
import {
  formatResolvedKeywordCall,
  resolveKeywordRef,
} from "../projectIntelligence/keywordResolve.js";
import type { ParsedLocatorLine, ResolvedLocator, StepIntent } from "./types.js";

const DEFAULT_WAIT_SEC = 10;

/** Groovy comment line from embedded step text, e.g. `Click: إغلاق الاستبيان` (selector still drives execution). */
function stepCommentFromEmbeddedHint(
  verb: "click" | "tap" | "type",
  hint: string
): string | undefined {
  const embedded = extractSelectorFromHint(hint);
  const label = embedded?.label?.trim();
  if (!label) return undefined;
  if (verb === "click") return `Click: ${label}`;
  if (verb === "tap") return `Tap: ${label}`;
  return `Type: ${label}`;
}

export type InternalOp =
  | { kind: "openBrowser"; url: string }
  | { kind: "maximize" }
  | { kind: "navigate"; url: string }
  | { kind: "waitVisible"; loc: ResolvedLocator }
  | { kind: "click"; loc: ResolvedLocator; stepComment?: string }
  | { kind: "check"; loc: ResolvedLocator }
  | { kind: "uncheck"; loc: ResolvedLocator }
  | { kind: "setText"; loc: ResolvedLocator; text: string; stepComment?: string }
  | { kind: "sendEnter"; loc: ResolvedLocator }
  | { kind: "sendKey"; loc: ResolvedLocator; key: string }
  | { kind: "verifyTextPresent"; text: string; caseSensitive: boolean }
  | { kind: "verifyElementVisible"; loc: ResolvedLocator }
  | { kind: "closeBrowser" }
  | { kind: "startApplication"; path: string }
  | { kind: "tap"; loc: ResolvedLocator; stepComment?: string }
  | { kind: "mobileSetText"; loc: ResolvedLocator; text: string; stepComment?: string }
  | { kind: "swipeComment" }
  | { kind: "waitPage"; seconds: number }
  /** Preserves step order in output when a step cannot be compiled (no silent drop). */
  | { kind: "compilerComment"; text: string }
  /** Reuse existing project custom keyword */
  | { kind: "customKeyword"; call: string; stepComment?: string };

export interface CompileActionsResult {
  operations: InternalOp[];
  warnings: string[];
  /** Kept for API compatibility; compiler uses fallbacks so this stays empty in normal flows. */
  errors: string[];
}

function resolveUrlForOpen(url: string | undefined, fallback?: string): string {
  const u = url?.trim() || fallback?.trim() || "";
  return u || "about:blank";
}

function escGroovyString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Fallback when project index is missing but step names a Class.method ref. */
function synthesizeKeywordCall(
  ref: string,
  defaultUrl?: string,
  literalArgs?: string[]
): string {
  const path = ref.trim().replace(/^CustomKeywords\s*\.\s*'?|'?$/gi, "").trim();
  if (!path.includes(".")) return "";
  const url = resolveUrlParameterValue(literalArgs?.[0], defaultUrl);
  return `CustomKeywords.'${escGroovyString(path)}'('${escGroovyString(url)}')`;
}

function resolveKeywordCallForRef(
  ref: string,
  keywords: ParsedKeywordClass[] | undefined,
  defaultUrl?: string,
  stepRaw?: string
): string | undefined {
  const trimmed = ref.trim();
  if (!trimmed) return undefined;
  const literalArgs = stepRaw ? extractKeywordArgsFromStep(stepRaw) : [];
  const kwOpts = {
    defaultUrl,
    stepLiteralArgs: literalArgs.length ? literalArgs : undefined,
  };
  if (keywords?.length) {
    const resolved = resolveKeywordRef(trimmed, keywords);
    if (resolved) {
      return formatResolvedKeywordCall(resolved, kwOpts);
    }
  }
  return synthesizeKeywordCall(trimmed, defaultUrl, literalArgs) || undefined;
}

function bodyLocatorForKeys(pageUrl?: string): ResolvedLocator | null {
  return buildResolvedLocatorFromRhs("keysTarget", "//body", true, { pageUrl });
}

/**
 * Maps parsed step intents + locator table → ordered operations (deterministic).
 * OR match is optional: recorded selectors / parsed lines build dynamic TestObjects.
 * Unresolved locators → XPath text fallback so generation always produces operations.
 */
export function compileActions(
  intents: StepIntent[],
  locs: ResolvedLocator[],
  options: {
    platform: "web" | "mobile";
    defaultUrl?: string;
    parsedLines: ParsedLocatorLine[];
    selectorByTestObjectLabel?: Record<string, string>;
    /** Same length as `intents`: raw Playwright `context.selector` per step when label lookup fails. */
    playwrightContextSelectors?: (string | undefined)[];
    projectBindingsByStepIndex?: Record<
      number,
      { orPath?: string; orLabel?: string; keywordCall?: string }
    >;
    /** Same length as intents — original test step index for project bindings. */
    sourceStepIndexByIntent?: number[];
    projectKeywords?: ParsedKeywordClass[];
  }
): CompileActionsResult {
  const warnings: string[] = [];
  const operations: InternalOp[] = [];
  const errors: string[] = [];
  const state = new StateTracker();
  const { parsedLines, selectorByTestObjectLabel, playwrightContextSelectors } = options;
  const pageUrl = options.defaultUrl?.trim();

  const parallelOk =
    !!playwrightContextSelectors && playwrightContextSelectors.length === intents.length;

  const resolve = (hint: string, intent?: LocatorMatchIntent): ResolvedLocator | null =>
    resolveLocatorWithFallbacks(hint, locs, parsedLines, selectorByTestObjectLabel, pageUrl, intent);

  const resolveWithRecordingSelector = (
    hint: string,
    intentIdx: number,
    intent?: LocatorMatchIntent
  ): ResolvedLocator | null => {
    const r = resolveLocatorWithFallbacks(hint, locs, parsedLines, selectorByTestObjectLabel, pageUrl, intent);
    if (r) return r;
    if (!parallelOk || !playwrightContextSelectors) return null;
    const sel = playwrightContextSelectors[intentIdx];
    if (typeof sel !== "string" || !sel.trim()) return null;
    return buildResolvedLocatorFromRhs(hint, sel, true, { pageUrl });
  };

  const ensureLoc = (
    hint: string,
    intentIdx: number,
    intent: LocatorMatchIntent | undefined,
    stepLabel: string
  ): ResolvedLocator => {
    let loc = resolveWithRecordingSelector(hint, intentIdx, intent);
    if (loc) return loc;
    warnings.push(
      `${stepLabel}: no locator match for "${hint}" — using XPath contains(normalize-space(.),…) fallback`
    );
    loc = buildFallbackResolvedLocator(hint, pageUrl);
    if (loc) return loc;
    const body = bodyLocatorForKeys(pageUrl);
    if (body) return body;
    return buildFallbackResolvedLocator("element", pageUrl)!;
  };

  const projectBinding = (intentIdx: number) => {
    const stepIdx = options.sourceStepIndexByIntent?.[intentIdx];
    if (stepIdx == null || stepIdx < 0) return undefined;
    return options.projectBindingsByStepIndex?.[stepIdx];
  };

  const orPathLocator = (
    orPath: string,
    label: string
  ): ResolvedLocator => ({
    label,
    varBase: label.replace(/[^\w\u0600-\u06FF]+/g, "_").slice(0, 40) || "orEl",
    kind: "orPath",
    propertyName: "",
    value: orPath,
    orPath,
    score: 100,
  });

  for (let intentIdx = 0; intentIdx < intents.length; intentIdx++) {
    const intent = intents[intentIdx];
    const binding = projectBinding(intentIdx);

    let keywordCall = binding?.keywordCall;
    if (!keywordCall && intent.kind === "callKeyword") {
      keywordCall = resolveKeywordCallForRef(
        intent.ref,
        options.projectKeywords,
        options.defaultUrl,
        intent.raw
      );
    }

    if (
      keywordCall &&
      (intent.kind === "openBrowser" || intent.kind === "navigate") &&
      /open|url|browser|navigate|launch/i.test(keywordCall)
    ) {
      operations.push({
        kind: "customKeyword",
        call: keywordCall,
        stepComment: "Open application (project)",
      });
      continue;
    }

    if (
      keywordCall &&
      intent.kind !== "openBrowser" &&
      intent.kind !== "navigate" &&
      intent.kind !== "closeBrowser" &&
      intent.kind !== "maximize" &&
      intent.kind !== "waitPage"
    ) {
      operations.push({
        kind: "customKeyword",
        call: keywordCall,
        stepComment: intent.kind === "callKeyword" ? intent.ref : "Project keyword",
      });
      continue;
    }

    switch (intent.kind) {
      case "comment": {
        operations.push({
          kind: "compilerComment",
          text: intent.raw.trim().startsWith("//") ? intent.raw.trim().slice(2).trim() : intent.raw.trim(),
        });
        break;
      }
      case "callKeyword": {
        operations.push({
          kind: "compilerComment",
          text: `// Keyword not resolved: ${intent.ref} — use Class.method (e.g. common.WebUiHelpers.openToUrl) with an active project`,
        });
        warnings.push(
          `callKeyword "${intent.ref}": not resolved — upload project, set Active project, or check spelling`
        );
        break;
      }
      case "openBrowser": {
        const url = resolveUrlForOpen(intent.url, options.defaultUrl);
        operations.push({ kind: "openBrowser", url });
        break;
      }
      case "navigate": {
        operations.push({ kind: "navigate", url: intent.url });
        break;
      }
      case "maximize": {
        operations.push({ kind: "maximize" });
        break;
      }
      case "closeBrowser": {
        operations.push({ kind: "closeBrowser" });
        break;
      }
      case "waitPage": {
        operations.push({ kind: "waitPage", seconds: intent.seconds });
        break;
      }
      case "startApplication": {
        operations.push({ kind: "startApplication", path: intent.path });
        break;
      }
      case "swipe": {
        operations.push({ kind: "swipeComment" });
        warnings.push(
          "Swipe step: add coordinates or use Mobile.swipe per your Katalon version — placeholder comment emitted."
        );
        break;
      }
      case "click":
      case "tap": {
        if (binding?.orPath) {
          const loc = orPathLocator(binding.orPath, binding.orLabel ?? binding.orPath);
          state.setFromLocator(loc);
          const stepComment = stepCommentFromEmbeddedHint(
            intent.kind === "tap" ? "tap" : "click",
            intent.targetHint
          );
          operations.push({
            kind: intent.kind === "tap" ? "tap" : "click",
            loc,
            ...(stepComment ? { stepComment } : {}),
          });
          break;
        }
        const loc = ensureLoc(intent.targetHint, intentIdx, "click", intent.kind);
        state.setFromLocator(loc);
        const stepComment = stepCommentFromEmbeddedHint(
          intent.kind === "tap" ? "tap" : "click",
          intent.targetHint
        );
        operations.push({
          kind: intent.kind === "tap" ? "tap" : "click",
          loc,
          ...(stepComment ? { stepComment } : {}),
        });
        break;
      }
      case "check":
      case "uncheck": {
        const loc = ensureLoc(intent.targetHint, intentIdx, "check", intent.kind);
        state.setFromLocator(loc);
        operations.push({ kind: intent.kind, loc });
        break;
      }
      case "setText":
      case "mobileSetText": {
        if (binding?.orPath) {
          const loc = orPathLocator(binding.orPath, binding.orLabel ?? binding.orPath);
          state.setFromLocator(loc);
          const stepComment = stepCommentFromEmbeddedHint("type", intent.targetHint);
          operations.push({
            kind: intent.kind === "mobileSetText" ? "mobileSetText" : "setText",
            loc,
            text: intent.text,
            ...(stepComment ? { stepComment } : {}),
          });
          break;
        }
        if (options.platform === "mobile" && !intent.text?.trim()) {
          errors.push(
            `mobileSetText: missing value — add quoted text, e.g. type \"john\" in username (step: "${(intent as any).targetHint ?? ""}")`
          );
          operations.push({
            kind: "compilerComment",
            text: `ERROR: mobileSetText missing value for "${(intent as any).targetHint ?? ""}"`,
          });
          break;
        }
        const loc = ensureLoc(intent.targetHint, intentIdx, "type", intent.kind);
        state.setFromLocator(loc);
        const stepComment = stepCommentFromEmbeddedHint("type", intent.targetHint);
        operations.push({
          kind: intent.kind === "mobileSetText" ? "mobileSetText" : "setText",
          loc,
          text: intent.text,
          ...(stepComment ? { stepComment } : {}),
        });
        break;
      }
      case "pressEnter": {
        let loc = state.getForImplicitKeyboard();
        if (!loc && locs.length === 1) {
          loc = resolve(locs[0].label, "type");
        }
        if (!loc) {
          warnings.push("pressEnter: no focused element — sending keys on //body fallback");
          loc = bodyLocatorForKeys(pageUrl) ?? buildFallbackResolvedLocator("enter", pageUrl)!;
        }
        state.setFromLocator(loc);
        operations.push({ kind: "sendEnter", loc });
        break;
      }
      case "sendKey": {
        const loc = ensureLoc(intent.targetHint, intentIdx, undefined, "sendKey");
        state.setFromLocator(loc);
        operations.push({ kind: "sendKey", loc, key: intent.key });
        break;
      }
      case "verifyTextPresent": {
        operations.push({
          kind: "verifyTextPresent",
          text: intent.text,
          caseSensitive: intent.caseSensitive !== true ? false : true,
        });
        break;
      }
      case "verifyElementVisible": {
        const loc = ensureLoc(intent.targetHint, intentIdx, "verify", "verifyElementVisible");
        operations.push({ kind: "verifyElementVisible", loc });
        break;
      }
      case "unknown": {
        warnings.push(`Unrecognized step (skipped): ${intent.raw}`);
        operations.push({
          kind: "compilerComment",
          text: `UNPARSED STEP — add a clearer line or locator: ${intent.raw}`,
        });
        break;
      }
      default: {
        warnings.push(`Unhandled intent kind in compiler: ${JSON.stringify(intent)}`);
        operations.push({
          kind: "compilerComment",
          text: `INTERNAL: unhandled intent ${JSON.stringify(intent)}`,
        });
        break;
      }
    }
  }

  return { operations, warnings, errors };
}

export { DEFAULT_WAIT_SEC };
