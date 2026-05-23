import type {
  GenerationPlan,
  ProjectGenerationMode,
  ProjectIndex,
  StepBinding,
} from "./types.js";
import { formatKeywordCall } from "./keywordParser.js";
import {
  formatResolvedKeywordCall,
  resolveKeywordRef,
} from "./keywordResolve.js";
import {
  extractKeywordArgsFromStep,
  extractKeywordRefFromStep,
  extractLocatorAssignmentFromStep,
  extractLocatorHintFromStep,
  extractOrPathFromStep,
} from "./stepReferenceExtractor.js";
import {
  findTestObjectExactMatch,
  isWeakPrefixOrMatch,
  matchKeywordByRef,
  matchKeywordsForStep,
  matchTestObjectByLocatorHint,
  matchTestObjectsForStep,
  matchTestScriptsForStep,
} from "./semanticMatcher.js";
import { stepRequestsProjectWebsite } from "./projectUrlResolver.js";
import { pickDefaultKeywordMethod } from "./keywordResolve.js";

function thresholds(mode: ProjectGenerationMode): { or: number; kw: number } {
  switch (mode) {
    case "strict_reuse":
      return { or: 0.55, kw: 0.6 };
    case "generate_everything":
      return { or: 0.95, kw: 0.95 };
    default:
      return { or: 0.35, kw: 0.45 };
  }
}

function findTestObjectByPath(
  index: ProjectIndex,
  orPath: string
): { path: string; label: string } | null {
  const norm = orPath.replace(/^Object Repository\//i, "").trim();
  const hit = index.testObjects.find(
    (o) => o.path === norm || o.path.toLowerCase() === norm.toLowerCase()
  );
  return hit ? { path: hit.path, label: hit.label } : null;
}

/**
 * Build per-step bindings and extra locator lines from project index + step text.
 */
export interface BuildGenerationPlanOptions {
  defaultUrl?: string;
  /** Primary app URL learned from project scripts (openBrowser / openToUrl). */
  projectDefaultUrl?: string;
}

export function buildGenerationPlan(
  steps: string[],
  index: ProjectIndex,
  mode: ProjectGenerationMode = "balanced",
  platform: "web" | "mobile" = "web",
  options?: BuildGenerationPlanOptions
): GenerationPlan {
  const { or: orMin, kw: kwMin } = thresholds(mode);
  const bindings: StepBinding[] = [];
  const extraLocatorLines: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];
  const usedOr = new Set<string>();
  const usedKw = new Set<string>();

  const addLocatorLine = (label: string, rhs: string) => {
    const line = `${label} = ${rhs}`;
    if (!extraLocatorLines.includes(line)) extraLocatorLines.push(line);
  };

  for (let i = 0; i < steps.length; i++) {
    const stepText = steps[i].trim();
    if (!stepText) continue;

    const literalArgs = extractKeywordArgsFromStep(stepText);
    const effectiveUrl = options?.projectDefaultUrl?.trim() || options?.defaultUrl?.trim();
    const kwOpts = {
      defaultUrl: effectiveUrl,
      stepLiteralArgs: literalArgs.length ? literalArgs : undefined,
    };

    if (stepRequestsProjectWebsite(stepText) && effectiveUrl && mode !== "generate_everything") {
      const openKw = index.keywords
        .map((kw) => {
          const method = pickDefaultKeywordMethod(kw);
          if (!method) return null;
          if (!/open|url|browser|navigate|launch/i.test(method.name)) return null;
          return { kw, method };
        })
        .find(Boolean);
      if (openKw) {
        const callKey = `${openKw.kw.customKeywordsPath}.${openKw.method.name}`;
        usedKw.add(callKey);
        bindings.push({
          stepIndex: i,
          stepText,
          keywordCall: formatResolvedKeywordCall(openKw, kwOpts),
          confidence: 0.92,
          source: "keyword",
        });
        continue;
      }
    }

    let binding: StepBinding = {
      stepIndex: i,
      stepText,
      confidence: 0,
      source: "inline",
    };

    const embeddedAssign = extractLocatorAssignmentFromStep(stepText);
    if (embeddedAssign) {
      addLocatorLine(embeddedAssign.label, embeddedAssign.rhs);
      const pathHit = embeddedAssign.rhs.includes("/")
        ? findTestObjectByPath(index, embeddedAssign.rhs)
        : null;
      if (pathHit) {
        binding = {
          stepIndex: i,
          stepText,
          orPath: pathHit.path,
          orLabel: embeddedAssign.label || pathHit.label,
          confidence: 1,
          source: "test_object",
        };
        bindings.push(binding);
        continue;
      }
    }

    const explicitOr = extractOrPathFromStep(stepText);
    if (explicitOr) {
      const hit = findTestObjectByPath(index, explicitOr);
      if (hit) {
        addLocatorLine(hit.label, hit.path);
        binding = {
          stepIndex: i,
          stepText,
          orPath: hit.path,
          orLabel: hit.label,
          confidence: 1,
          source: "test_object",
        };
        bindings.push(binding);
        continue;
      }
      addLocatorLine(explicitOr.split("/").pop() ?? explicitOr, explicitOr);
    }

    const keywordRef = extractKeywordRefFromStep(stepText);
    if (keywordRef && mode !== "generate_everything") {
      const resolved = resolveKeywordRef(keywordRef, index.keywords);
      if (resolved) {
        const callKey = `${resolved.kw.customKeywordsPath}.${resolved.method.name}`;
        const call = formatResolvedKeywordCall(resolved, kwOpts);
        usedKw.add(callKey);
        bindings.push({
          stepIndex: i,
          stepText,
          keywordCall: call,
          confidence: 0.95,
          source: "keyword",
        });
        continue;
      }
      const kwHits = matchKeywordByRef(keywordRef, index.keywords, 0.35);
      if (kwHits.length > 0) {
        const best = kwHits[0];
        const callKey = `${best.item.kw.customKeywordsPath}.${best.item.method.name}`;
        const call = formatKeywordCall(best.item.kw, best.item.method, kwOpts);
        usedKw.add(callKey);
        bindings.push({
          stepIndex: i,
          stepText,
          keywordCall: call,
          confidence: best.score,
          source: "keyword",
        });
        continue;
      }
      warnings.push(
        `Step ${i + 1}: keyword "${keywordRef}" not found — use Class.method (e.g. common.WebUiHelpers.openToUrl) or check spelling/casing`
      );
    }

    const locatorHint = extractLocatorHintFromStep(stepText, platform);
    if (locatorHint) {
      const exactOr = findTestObjectExactMatch(locatorHint, index.testObjects);
      if (exactOr && mode !== "generate_everything") {
        usedOr.add(exactOr.path);
        addLocatorLine(exactOr.label, exactOr.path);
        bindings.push({
          stepIndex: i,
          stepText,
          orPath: exactOr.path,
          orLabel: exactOr.label,
          confidence: 1,
          source: "test_object",
        });
        continue;
      }

      const orHits = matchTestObjectByLocatorHint(locatorHint, index.testObjects, orMin);
      if (orHits.length > 0 && mode !== "generate_everything") {
        const best = orHits[0];
        if (!usedOr.has(best.item.path) || mode === "strict_reuse") {
          usedOr.add(best.item.path);
          addLocatorLine(best.item.label, best.item.path);
          binding = {
            stepIndex: i,
            stepText,
            orPath: best.item.path,
            orLabel: best.item.label,
            confidence: best.score,
            source: "test_object",
          };
          bindings.push(binding);
          continue;
        }
      }
    }

    const kwMatches = matchKeywordsForStep(stepText, index.keywords, kwMin);
    const orMatches = matchTestObjectsForStep(stepText, index.testObjects, orMin);
    const scripts = index.testScripts ?? index.testCases ?? [];
    const scriptMatches = matchTestScriptsForStep(stepText, scripts, kwMin);

    if (kwMatches.length > 0 && mode !== "generate_everything") {
      const best = kwMatches[0];
      const callKey = `${best.item.kw.customKeywordsPath}.${best.item.method.name}`;
      if (!usedKw.has(callKey) || mode === "strict_reuse") {
        usedKw.add(callKey);
        bindings.push({
          stepIndex: i,
          stepText,
          keywordCall: formatKeywordCall(best.item.kw, best.item.method, kwOpts),
          confidence: best.score,
          source: "keyword",
        });
        continue;
      }
    }

    if (scriptMatches.length > 0 && mode !== "generate_everything") {
      const bestScript = scriptMatches[0];
      suggestions.push(
        `Step ${i + 1}: similar existing script "${bestScript.item.displayName}" (${bestScript.item.logicalPath})`
      );
    }

    if (locatorHint && mode !== "generate_everything") {
      const exactFallback = findTestObjectExactMatch(locatorHint, index.testObjects);
      if (exactFallback && !bindings.some((b) => b.stepIndex === i && b.orPath)) {
        usedOr.add(exactFallback.path);
        addLocatorLine(exactFallback.label, exactFallback.path);
        bindings.push({
          stepIndex: i,
          stepText,
          orPath: exactFallback.path,
          orLabel: exactFallback.label,
          confidence: 1,
          source: "test_object",
        });
        continue;
      }
    }

    if (orMatches.length > 0 && mode !== "generate_everything") {
      const best =
        locatorHint != null
          ? orMatches.find((m) => !isWeakPrefixOrMatch(locatorHint, m.item)) ?? orMatches[0]
          : orMatches[0];
      if (!usedOr.has(best.item.path) || mode === "strict_reuse") {
        usedOr.add(best.item.path);
        addLocatorLine(best.item.label, best.item.path);
        binding = {
          stepIndex: i,
          stepText,
          orPath: best.item.path,
          orLabel: best.item.label,
          confidence: best.score,
          source: "test_object",
        };
        bindings.push(binding);
        continue;
      }
    }

    if (locatorHint && mode !== "generate_everything") {
      warnings.push(
        `Step ${i + 1}: no Object Repository match for locator "${locatorHint}" — add "Label = Page/Path" in Locators or pick active project`
      );
    }

    bindings.push(binding);
  }

  if (index.stats.testObjects === 0 && index.stats.keywords === 0) {
    warnings.push("Project index has no parsed test objects or keywords — upload a full Katalon project zip.");
  }

  return {
    projectId: index.projectId,
    mode,
    bindings,
    extraLocatorLines,
    warnings,
    suggestions,
  };
}

export function mergeLocatorTextWithPlan(
  userLocators: string,
  plan: GenerationPlan
): string {
  const parts = [userLocators.trim(), plan.extraLocatorLines.join("\n")].filter(Boolean);
  return parts.join("\n");
}

/** Pull `label = path` and explicit OR paths from step lines into locator text. */
export function enrichLocatorsFromSteps(
  userLocators: string,
  steps: string[],
  platform: "web" | "mobile"
): string {
  const extra: string[] = [];
  for (const step of steps) {
    const assign = extractLocatorAssignmentFromStep(step);
    if (assign) {
      extra.push(`${assign.label} = ${assign.rhs}`);
      continue;
    }
    const path = extractOrPathFromStep(step);
    const hint = extractLocatorHintFromStep(step, platform);
    if (path && hint) extra.push(`${hint} = ${path}`);
    else if (path) extra.push(`${path.split("/").pop() ?? path} = ${path}`);
  }
  if (!extra.length) return userLocators.trim();
  return [userLocators.trim(), ...extra].filter(Boolean).join("\n");
}

export function bindingsByStepIndex(plan: GenerationPlan): Record<number, StepBinding> {
  const m: Record<number, StepBinding> = {};
  for (const b of plan.bindings) {
    if (b.confidence > 0 || b.orPath || b.keywordCall) {
      m[b.stepIndex] = b;
    }
  }
  return m;
}
