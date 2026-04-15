export type DslAction =
  | "navigate"
  | "click"
  | "type"
  | "verify"
  | "wait"
  | "select"
  | "upload"
  | "pressEnter"
  | "keyAction"
  | "check"
  | "uncheck";

/** High-level QA intent (compiler / reporting). */
export type SemanticIntentKind = "navigation" | "interaction" | "input" | "validation" | "system";

export interface ClassifiedStep {
  action: DslAction | "unknown";
  raw: string;
  lower: string;
}

const URL_RE = /(https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+)/i;

const KNOWN_SITE_ALIASES: Record<string, string> = {
  google: "https://www.google.com/",
  "google.com": "https://www.google.com/",
  youtube: "https://www.youtube.com/",
  "youtube.com": "https://www.youtube.com/",
  github: "https://github.com/",
  "github.com": "https://github.com/",
  bing: "https://www.bing.com/",
  "bing.com": "https://www.bing.com/",
};

/**
 * Resolve phrases like "go to google" / "visit github.com" when no URL is present.
 */
export function inferKnownSiteUrl(raw: string): string | undefined {
  const s = raw.trim();
  const m = s.match(/\b(?:go\s+to|visit|open|navigate(?:\s+to)?)\s+([a-z0-9][a-z0-9.-]*)\b/i);
  if (!m) return undefined;
  const host = m[1].toLowerCase();
  if (KNOWN_SITE_ALIASES[host]) return KNOWN_SITE_ALIASES[host];
  if (host.includes(".")) {
    return /^https?:\/\//i.test(host) ? host : `https://${host}`;
  }
  return undefined;
}

export function mapActionToSemanticIntent(action: DslAction | "unknown"): SemanticIntentKind {
  switch (action) {
    case "navigate":
      return "navigation";
    case "click":
    case "check":
    case "uncheck":
    case "pressEnter":
    case "keyAction":
      return "interaction";
    case "type":
    case "select":
    case "upload":
      return "input";
    case "verify":
      return "validation";
    case "wait":
      return "system";
    default:
      return "validation";
  }
}

export function detectUrl(s: string): string | undefined {
  const m = s.match(URL_RE);
  if (!m) return undefined;
  let u = m[1];
  if (u.startsWith("www.")) u = `https://${u}`;
  return u;
}

export function classifyIntent(raw: string): ClassifiedStep {
  const s = raw.trim();
  const lower = s.toLowerCase();
  const url = detectUrl(s);

  // Before "press" as click: Enter / Return
  if (/\b(press|hit)\s*(enter|return)\b/i.test(lower) || /\bsend\s*keys?\s*:?\s*enter\b/i.test(lower)) {
    return { action: "pressEnter", raw: s, lower };
  }

  if (/^\s*keyAction\s+"/i.test(s)) {
    return { action: "keyAction", raw: s, lower };
  }

  if (/\b(wait|delay|sleep)\b/i.test(lower)) return { action: "wait", raw: s, lower };
  if (/^\s*check\s+\S+/i.test(s)) return { action: "check", raw: s, lower };
  if (/^\s*uncheck\s+\S+/i.test(s)) return { action: "uncheck", raw: s, lower };
  if (/\b(verify|assert|expect)\b/i.test(lower)) return { action: "verify", raw: s, lower };
  if (/\b(select|choose|pick)\b/i.test(lower)) return { action: "select", raw: s, lower };
  if (/\b(upload|attach)\b/i.test(lower)) return { action: "upload", raw: s, lower };
  // "search testing" / "search for X" as query into search field (not "search field" / "search button")
  if (
    /^\s*search\s+/i.test(s) &&
    !/\b(field|button|box|bar|input)\b/i.test(lower)
  ) {
    return { action: "type", raw: s, lower };
  }

  if (/\b(type|enter|input|write|fill|set\s+text)\b/i.test(lower)) return { action: "type", raw: s, lower };
  // If the line is "write andrew" / "type andrew" (no explicit field), treat it as type.
  if (/^\s*(?:write|type|enter)\b/i.test(lower)) return { action: "type", raw: s, lower };
  if (/\b(click|tap|press)\b/i.test(lower)) return { action: "click", raw: s, lower };
  if (/\b(open|launch|start)\b/i.test(lower) && /\b(browser)\b/i.test(lower)) {
    return { action: "navigate", raw: s, lower };
  }
  if (url && /\b(visit|open|go\s+to|navigate|load)\b/i.test(lower)) return { action: "navigate", raw: s, lower };
  if (url) return { action: "navigate", raw: s, lower };

  const site = inferKnownSiteUrl(s);
  if (site && /\b(visit|open|go\s+to|navigate|load)\b/i.test(lower)) {
    return { action: "navigate", raw: s, lower };
  }

  // Fallback heuristics: if it starts with a verb but we didn't catch it, mark unknown.
  return { action: "unknown", raw: s, lower };
}

