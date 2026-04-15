export type IntentAction =
  | "search"
  | "login"
  | "click"
  | "check"
  | "uncheck"
  | "navigate"
  | "verify"
  | "upload"
  | "select"
  | "scroll"
  | "pressEnter"
  | "unknown";

export interface ParsedIntent {
  action: IntentAction;
  /** Primary free-text target (e.g., search query, destination, verify text) */
  target?: string;
  /** Optional additional fields */
  username?: string;
  password?: string;
  url?: string;
  raw: string;
  platform: "web" | "mobile";
}

import { normalizeLocatorHint } from "../katalonCompiler/locatorResolve.js";
import { tryPressEnterIntent } from "../katalonCompiler/stepHints.js";

const URL_RE = /(https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+)/i;

function extractUrl(s: string): string | undefined {
  const m = s.match(URL_RE);
  if (!m) return undefined;
  let u = m[1];
  if (u.startsWith("www.")) u = `https://${u}`;
  return u;
}

function extractQuoted(s: string): string | undefined {
  const m = s.match(/["'“”]([^"'“”]+)["'“”]/);
  return m ? m[1].trim() : undefined;
}

export function parseIntent(step: string, platform: "web" | "mobile"): ParsedIntent {
  const raw = step.trim();
  const lower = raw.toLowerCase();
  const url = extractUrl(raw);
  const quoted = extractQuoted(raw);

  if (!raw) return { action: "unknown", raw, platform };

  const pressEnter = tryPressEnterIntent(raw);
  if (pressEnter?.kind === "pressEnter") {
    return { action: "pressEnter", raw, platform };
  }

  // search: "search for X", "google X", "find X"
  // Do not treat as search when the line is clearly a navigation ("visit google https://…").
  const skipSearchBecauseNavigate = /\b(visit|navigate)\b/i.test(lower);
  const searchMatch =
    !skipSearchBecauseNavigate &&
    (raw.match(/\bsearch\s+for\s+(.+)$/i) ||
      raw.match(/\bfind\s+(.+)$/i) ||
      raw.match(/\bgoogle\s+(.+)$/i) ||
      raw.match(/\bsearch\s+(.+)$/i));
  if (searchMatch) {
    const target = (quoted ?? searchMatch[1]).trim();
    if (target) return { action: "search", target, raw, platform };
  }

  if (/\b(login|sign\s*in|log\s*in)\b/i.test(lower)) {
    const u = raw.match(/\b(username|user|email)\s*[:=]\s*([^\s,]+)\b/i);
    const p = raw.match(/\b(password|pass)\s*[:=]\s*([^\s,]+)\b/i);
    return {
      action: "login",
      username: u ? u[2] : undefined,
      password: p ? p[2] : undefined,
      raw,
      platform,
    };
  }

  if (/^\s*check\s+/i.test(raw)) {
    const t = raw.replace(/^\s*check\s+/i, "").trim();
    if (t) return { action: "check", target: t, raw, platform };
  }
  if (/^\s*uncheck\s+/i.test(raw)) {
    const t = raw.replace(/^\s*uncheck\s+/i, "").trim();
    if (t) return { action: "uncheck", target: t, raw, platform };
  }

  // Interaction verbs BEFORE URL→navigate heuristics so lines like "click … https://…" stay clicks.
  if (/\bclick|tap|press\b/i.test(lower)) {
    const fragment =
      quoted ??
      raw
        .replace(/^.*?\b(click|tap|press)\b/i, "")
        .trim();
    const t = normalizeLocatorHint(fragment) || fragment;
    return { action: "click", target: t || raw, raw, platform };
  }

  if (url && /\b(navigate|go\s+to|visit|open)\b/i.test(lower)) {
    return { action: "navigate", url, target: url, raw, platform };
  }

  if (/\bverify|assert|expect\b/i.test(lower)) {
    const t =
      quoted ??
      raw
        .replace(/\b(verify|assert|expect|that|page|screen|contains|has)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    return { action: "verify", target: t || quoted, raw, platform };
  }

  // Do NOT treat "any line containing a URL" as a navigation — that swallowed post-navigate steps
  // (e.g. descriptions with links). Bare URLs fall through to unknown → legacy stepParser.

  return { action: "unknown", raw, platform };
}

