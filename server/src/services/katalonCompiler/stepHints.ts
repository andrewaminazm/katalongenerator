import type { StepIntent } from "./types.js";

export function extractQuoted(step: string): string | undefined {
  const m = step.match(/["'“”]([^"'“”]+)["'“”]/);
  return m ? m[1].trim() : undefined;
}

/** "Click Enter" / "tap return" → keyboard key, not a locator named "enter". */
export function tryPressEnterIntent(raw: string): StepIntent | null {
  const lower = raw.toLowerCase();
  if (!/\b(click|tap|press)\b/i.test(lower)) return null;
  if (extractQuoted(raw)) return null;
  const afterVerb = raw.replace(/^.*?\b(click|tap|press)\b/i, "").trim();
  const normalized = afterVerb
    .replace(/^the\s+/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (/^(enter|return)(\s+key)?$/.test(normalized)) {
    return { kind: "pressEnter" };
  }
  return null;
}
