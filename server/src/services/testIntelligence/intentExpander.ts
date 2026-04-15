import type { StepIntent } from "../katalonCompiler/types.js";
import type { ParsedIntent } from "./intentParser.js";

export interface ExpandOptions {
  platform: "web" | "mobile";
  defaultUrl?: string;
}

/**
 * Expands high-level intents into low-level compiler StepIntents.
 * Deterministic: no LLM use, no DOM access.
 */
export function expandIntent(intent: ParsedIntent, opts: ExpandOptions): StepIntent[] {
  const platform = opts.platform;
  if (intent.action === "pressEnter") {
    return [{ kind: "pressEnter" }];
  }
  if (intent.action === "search" && platform === "web") {
    const query = (intent.target ?? "").trim();
    if (!query) return [{ kind: "unknown", raw: intent.raw }];

    // Default: Google search flow.
    const url = "https://www.google.com/";
    return [
      { kind: "openBrowser", url },
      // Target hint is semantic; locator matching / naming engine should map it.
      { kind: "setText", targetHint: "search", text: query },
      { kind: "pressEnter" },
    ];
  }

  if (intent.action === "navigate" && intent.url) {
    return platform === "web"
      ? [{ kind: "navigate", url: intent.url }]
      : [{ kind: "unknown", raw: intent.raw }];
  }

  if (intent.action === "click" && intent.target) {
    return platform === "mobile"
      ? [{ kind: "tap", targetHint: intent.target }]
      : [{ kind: "click", targetHint: intent.target }];
  }

  if (platform === "web" && intent.action === "check" && intent.target) {
    return [{ kind: "check", targetHint: intent.target }];
  }
  if (platform === "web" && intent.action === "uncheck" && intent.target) {
    return [{ kind: "uncheck", targetHint: intent.target }];
  }

  if (intent.action === "verify" && intent.target) {
    // Default to text presence verification for web.
    return platform === "web"
      ? [{ kind: "verifyTextPresent", text: intent.target, caseSensitive: false }]
      : [{ kind: "unknown", raw: intent.raw }];
  }

  return [{ kind: "unknown", raw: intent.raw }];
}

