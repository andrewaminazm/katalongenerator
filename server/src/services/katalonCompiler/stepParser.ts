import type { StepIntent } from "./types.js";
import { normalizeLocatorHint } from "./locatorResolve.js";
import { extractQuoted, tryPressEnterIntent } from "./stepHints.js";

const URL_RE = /(https?:\/\/[^\s"'<>]+|www\.[^\s"'<>]+)/i;

function extractUrl(step: string): string | undefined {
  const m = step.match(URL_RE);
  if (!m) return undefined;
  let u = m[1];
  if (u.startsWith("www.")) u = `https://${u}`;
  return u;
}

/**
 * Deterministic heuristic mapping from free-text step lines to intents.
 */
export function parseStepLine(step: string, platform: "web" | "mobile"): StepIntent {
  const raw = step.trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return { kind: "unknown", raw };
  }

  const url = extractUrl(raw);

  if (
    /\b(open\s+browser|launch\s+browser|start\s+browser)\b/i.test(lower) ||
    (/\bopen\b/i.test(lower) && /\b(browser|chrome|firefox)\b/i.test(lower))
  ) {
    return { kind: "openBrowser", url: url ?? undefined };
  }

  if (/\b(navigate|go\s+to|visit|open\s+url)\b/i.test(lower)) {
    if (url) return { kind: "navigate", url };
    return { kind: "openBrowser", url: undefined };
  }

  if (/\bmaximize\b/i.test(lower) && /\b(window|browser)\b/i.test(lower)) {
    return { kind: "maximize" };
  }

  if (/\b(close\s+browser|quit\s+browser)\b/i.test(lower)) {
    return { kind: "closeBrowser" };
  }

  if (platform === "mobile") {
    if (/\b(start|launch)\s+(app|application)\b/i.test(lower) || /\bcold\s+start\b/i.test(lower)) {
      const q = extractQuoted(raw);
      return { kind: "startApplication", path: q ?? "" };
    }
    if (/\bswipe\b/i.test(lower)) {
      return { kind: "swipe" };
    }
    const enterAfterTap = tryPressEnterIntent(raw);
    if (enterAfterTap) return enterAfterTap;
    if (/\btap\b|\bclick\b|\bpress\b/i.test(lower)) {
      const fragment = extractQuoted(raw) ?? raw.replace(/^.*?\b(tap|click|press)\b/i, "").trim();
      const hint = normalizeLocatorHint(fragment) || fragment;
      return { kind: "tap", targetHint: hint || raw };
    }
    if (/\b(type|enter|input|set\s+text)\b/i.test(lower)) {
      const q = extractQuoted(raw);
      if (q) {
        const hint = raw
          .replace(/["'“”][^"'“”]+["'“”]/g, "")
          .replace(/\b(type|enter|input|fill|set\s+text|in|into|on|the|a|an)\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        return { kind: "mobileSetText", targetHint: hint || raw, text: q };
      }

      // Try to infer `type <target> <value>` (last token as value).
      const rest = raw.replace(/^.*?\b(type|enter|input|set\s+text)\b/i, "").trim();
      const m = rest.match(/^(.+?)\s+([^\s]+)\s*$/);
      if (m) {
        const hint = normalizeLocatorHint(m[1]) || m[1];
        return { kind: "mobileSetText", targetHint: hint || raw, text: m[2] };
      }

      // Missing value — keep empty; compile step will reject with validation error.
      const hint = raw
        .replace(/\b(type|enter|input|fill|set\s+text|in|into|on|the|a|an)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      return { kind: "mobileSetText", targetHint: hint || raw, text: "" };
    }
  }

  if (platform === "web") {
    const keyAct = raw.match(/^\s*keyAction\s+"([^"]+)"\s+(\S+)/i);
    if (keyAct) {
      return { kind: "sendKey", key: keyAct[1].trim(), targetHint: keyAct[2] };
    }
  }

  if (/\b(press|hit)\s*(enter|return)\b/i.test(lower) || /\bsend\s*keys?\s*:?\s*enter\b/i.test(lower)) {
    return { kind: "pressEnter" };
  }

  const enterAfterVerb = tryPressEnterIntent(raw);
  if (enterAfterVerb) return enterAfterVerb;

  if (platform === "web" && /\b(verify|assert|expect)\b/i.test(lower)) {
    const q = extractQuoted(raw);
    const rest = raw
      .replace(/["'“”][^"'“”]+["'“”]/g, "")
      .replace(/\b(verify|assert|expect|that|page|screen|contains|has|is|should|see)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const txt = (q ?? rest).trim();
    if (txt) return { kind: "verifyTextPresent", text: txt, caseSensitive: false };
  }

  if (/\bclick\b/i.test(lower)) {
    const fragment = extractQuoted(raw) ?? raw.replace(/^.*?\bclick\b/i, "").trim();
    const hint = normalizeLocatorHint(fragment) || fragment;
    return { kind: "click", targetHint: hint || raw };
  }

  if (/\b(type|enter|input|fill|set\s+text)\b/i.test(lower)) {
    const q = extractQuoted(raw);
    const text = q ?? "";
    const hint = raw
      .replace(/["'“”][^"'“”]+["'“”]/g, "")
      .replace(/\b(type|enter|input|fill|set\s+text|in|into|on|the|a|an)\b/gi, " ")
      .trim();
    return { kind: "setText", targetHint: hint || raw, text };
  }

  if (/\bwait\s*(for\s*)?(page|load)\b/i.test(lower)) {
    const n = raw.match(/(\d+)\s*(s|sec|seconds)?/i);
    return { kind: "waitPage", seconds: n ? Math.min(120, parseInt(n[1], 10)) : 30 };
  }

  if (url && (lower.includes("http") || lower.includes("www"))) {
    return { kind: "navigate", url };
  }

  return { kind: "unknown", raw };
}

export function parseAllSteps(steps: string[], platform: "web" | "mobile"): StepIntent[] {
  return steps.map((s) => parseStepLine(s, platform));
}
