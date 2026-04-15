import type { StepIntent } from "../katalonCompiler/types.js";

export interface AssertionContext {
  lastSearchQuery?: string;
  lastNavigateUrl?: string;
}

/**
 * Deterministically injects assertions after certain intents.
 * Does not generate Groovy; emits compiler StepIntents.
 */
export function injectAssertions(intents: StepIntent[], platform: "web" | "mobile"): StepIntent[] {
  const out: StepIntent[] = [];
  const ctx: AssertionContext = {};

  for (const i of intents) {
    out.push(i);

    if (platform !== "web") continue;

    if (i.kind === "navigate") {
      ctx.lastNavigateUrl = i.url;
    }

    if (i.kind === "setText") {
      // Heuristic: if this looked like a search box action, keep the text.
      const blob = `${i.targetHint}`.toLowerCase();
      if (/\bsearch\b|\bgoogle\b|\bquery\b/.test(blob)) {
        ctx.lastSearchQuery = i.text;
      }
    }

    if (i.kind === "pressEnter" && ctx.lastSearchQuery) {
      out.push({ kind: "verifyTextPresent", text: ctx.lastSearchQuery, caseSensitive: false });
      ctx.lastSearchQuery = undefined;
    }
  }

  return out;
}

