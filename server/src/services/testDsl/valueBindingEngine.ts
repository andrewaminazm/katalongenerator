import { detectUrl, inferKnownSiteUrl } from "./intentClassifier.js";

function extractQuoted(s: string): string | undefined {
  const m = s.match(/["'“”]([^"'“”]+)["'“”]/);
  return m ? m[1].trim() : undefined;
}

export interface BoundParts {
  url?: string;
  targetHint?: string;
  value?: string;
  seconds?: number;
}

/**
 * Extracts values (quoted text, URLs, wait durations) without treating them as locators.
 */
export function bindValues(action: string, raw: string): BoundParts {
  const s = raw.trim();
  const lower = s.toLowerCase();
  const q = extractQuoted(s);
  const url = detectUrl(s);

  if (action === "navigate") {
    return { url: url ?? inferKnownSiteUrl(s) };
  }

  if (action === "wait") {
    const n = s.match(/(\d+)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes)?/i);
    if (!n) return { seconds: 10 };
    const val = Math.min(300, parseInt(n[1], 10));
    const unit = (n[2] || "s").toLowerCase();
    const seconds = unit.startsWith("m") ? Math.min(300, val * 60) : val;
    return { seconds };
  }

  if (action === "type") {
    // Prefer quoted as the value; otherwise heuristically treat the trailing token(s) as the value when no field is named.
    let value = q ?? "";
    let hint = s
      .replace(/["'“”][^"'“”]+["'“”]/g, " ")
      .replace(/\b(type|enter|input|write|fill|set\s+text|in|into|on|the|a|an|to)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    // If user wrote "write andrew" with no other hint, bind "andrew" as value and leave targetHint empty.
    if (!value && hint && !/\b(field|input|box|textbox|username|password|email|search)\b/i.test(hint)) {
      value = hint;
      hint = "";
    }

    return { value, targetHint: hint || undefined };
  }

  if (action === "keyAction") {
    const m = s.match(/^\s*keyAction\s+"([^"]+)"\s+(\S+)/i);
    return { value: m?.[1] ?? "", targetHint: m?.[2] };
  }

  if (action === "click" || action === "select" || action === "upload" || action === "verify") {
    const hint =
      q ??
      s
        .replace(/^.*?\b(click|tap|press|select|choose|pick|upload|attach|verify|assert|expect|check)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    // For verify, also treat quoted as value when no target exists.
    if (action === "verify") return { value: q, targetHint: hint || undefined };
    if (action === "upload") return { value: q, targetHint: hint || undefined };
    if (action === "select") return { value: q, targetHint: hint || undefined };
    return { targetHint: hint || undefined };
  }

  // Default: keep quoted as value if any.
  return { value: q, url: url };
}

