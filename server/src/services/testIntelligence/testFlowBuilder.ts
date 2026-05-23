import type { StepIntent } from "../katalonCompiler/types.js";
import { parseIntent } from "./intentParser.js";
import { expandIntent, type ExpandOptions } from "./intentExpander.js";
import { injectAssertions } from "./assertionEngine.js";
import { stepLineImpliesBrowserKeyword } from "../projectIntelligence/keywordResolve.js";

export interface TestFlowResult {
  intents: StepIntent[];
  /** Parallel to intents — original step index in `steps[]`, or -1 for injected/setup rows. */
  sourceStepIndices: number[];
  warnings: string[];
}

/**
 * Builds an intelligent flow from user-provided free-text steps.
 */
export function buildTestFlow(steps: string[], opts: ExpandOptions): TestFlowResult {
  const warnings: string[] = [];
  const platform = opts.platform;

  const intents: StepIntent[] = [];
  const sourceStepIndices: number[] = [];

  for (let si = 0; si < steps.length; si++) {
    const s = steps[si];
    const pi = parseIntent(s, platform);
    if (pi.action === "unknown") {
      intents.push({ kind: "unknown", raw: s.trim() });
      sourceStepIndices.push(si);
      continue;
    }
    const expanded = expandIntent(pi, opts);
    for (const intent of expanded) {
      intents.push(intent);
      sourceStepIndices.push(si);
    }
  }

  let flowIntents = intents;
  let flowIndices = sourceStepIndices;

  if (platform === "web") {
    const injected = injectAssertions(flowIntents, platform);
    if (injected.length !== flowIntents.length) {
      const nextIndices: number[] = [];
      let j = 0;
      for (let i = 0; i < injected.length; i++) {
        if (j < flowIntents.length && injected[i] === flowIntents[j]) {
          nextIndices.push(flowIndices[j]);
          j++;
        } else {
          nextIndices.push(-1);
        }
      }
      flowIndices = nextIndices;
    }
    flowIntents = injected;
  }

  if (platform === "web") {
    const needsBrowser = flowIntents.some((i) =>
      [
        "click",
        "check",
        "uncheck",
        "setText",
        "pressEnter",
        "verifyTextPresent",
        "verifyElementVisible",
        "navigate",
      ].includes(i.kind)
    );
    const keywordOpensBrowser = flowIntents.some(
      (i) => i.kind === "callKeyword" && stepLineImpliesBrowserKeyword(i.ref)
    );
    const hasOpen = flowIntents.some((i) => i.kind === "openBrowser");
    const keywordOpensFirst = steps.some((s) => stepLineImpliesBrowserKeyword(s));
    if ((needsBrowser || keywordOpensBrowser) && !hasOpen && !keywordOpensFirst) {
      const url = opts.defaultUrl?.trim() || "about:blank";
      flowIntents = [{ kind: "openBrowser", url }, ...flowIntents];
      flowIndices = [-1, ...flowIndices];
      warnings.push("Test Intelligence: inserted openBrowser at start.");
    }
  }

  return { intents: flowIntents, sourceStepIndices: flowIndices, warnings };
}
