import type { StepIntent } from "../katalonCompiler/types.js";
import { parseIntent } from "./intentParser.js";
import { expandIntent, type ExpandOptions } from "./intentExpander.js";
import { injectAssertions } from "./assertionEngine.js";

/**
 * Builds an intelligent flow from user-provided free-text steps.
 * - Parses high-level intents (search/login/etc.)
 * - Expands into low-level StepIntents
 * - Injects assertions deterministically
 * - Ensures basic setup ordering (openBrowser first for web when needed)
 */
export function buildTestFlow(
  steps: string[],
  opts: ExpandOptions
): { intents: StepIntent[]; warnings: string[] } {
  const warnings: string[] = [];
  const platform = opts.platform;

  const expanded: StepIntent[] = [];
  for (const s of steps) {
    const pi = parseIntent(s, platform);
    if (pi.action === "unknown") {
      // Leave raw step to existing stepParser downstream as fallback.
      expanded.push({ kind: "unknown", raw: s.trim() });
      continue;
    }
    expanded.push(...expandIntent(pi, opts));
  }

  // Inject assertions (web only currently).
  let intents = injectAssertions(expanded, platform);

  // Ensure setup: openBrowser before first web action if missing.
  if (platform === "web") {
    const needsBrowser = intents.some((i) =>
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
    const hasOpen = intents.some((i) => i.kind === "openBrowser");
    if (needsBrowser && !hasOpen) {
      const url = opts.defaultUrl?.trim() || "about:blank";
      intents = [{ kind: "openBrowser", url }, ...intents];
      warnings.push("Test Intelligence: inserted openBrowser at start.");
    }
  }

  return { intents, warnings };
}

