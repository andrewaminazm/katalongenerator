import type { AriaRole } from "./roleMapper.js";
import type { SemanticAttributes } from "./attributeResolver.js";

export interface LocatorContext {
  url?: string;
  platform: "web" | "mobile";
}

function hostFromUrl(url?: string): string {
  try {
    if (!url) return "";
    return new URL(url).host.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Heuristics for well-known sites / patterns (optional but powerful).
 * Returns attribute overrides when confident.
 */
export function applyContextAwareHeuristics(
  intent: { role?: AriaRole; name?: string; label?: string; text?: string },
  ctx: LocatorContext
): Partial<SemanticAttributes> {
  const host = hostFromUrl(ctx.url);
  const role = (intent.role ?? "").toLowerCase();
  const nm = (intent.name ?? intent.label ?? "").trim();

  // Google: the primary search box is name="q"
  if (host.endsWith("google.com") || host.includes(".google.")) {
    if ((role === "textbox" || role === "searchbox") && /^(search|بحث)$/i.test(nm || "search")) {
      return { name: "q" };
    }
  }

  return {};
}

