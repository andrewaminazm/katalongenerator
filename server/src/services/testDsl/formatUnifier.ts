export type AnyStepsInput =
  | string[]
  | string
  | { steps?: unknown }
  | { acceptanceCriteria?: unknown }
  | unknown;

function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

/**
 * Converts any input into a flat list of raw step lines.
 * - Accepts arrays, multi-line text, numbered lists, CSV-ish rows, and simple JSON blobs.
 */
export function unifyToRawStepLines(input: AnyStepsInput): string[] {
  let text = "";
  let lines: string[] = [];

  if (isStringArray(input)) {
    lines = input;
  } else if (typeof input === "string") {
    text = input;
  } else if (input && typeof input === "object") {
    const any = input as Record<string, unknown>;
    if (isStringArray(any.steps)) lines = any.steps;
    else if (typeof any.steps === "string") text = any.steps;
    else if (typeof any.acceptanceCriteria === "string") text = any.acceptanceCriteria;
  }

  if (text && lines.length === 0) {
    lines = text.split(/\r?\n/);
  }

  const out: string[] = [];
  for (const raw of lines) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    // Split common bullet/numbering styles: "1- foo", "1. foo", "- foo"
    const m = s.match(/^\s*(?:\d+\s*[-.)]|[-*])\s*(.+)$/);
    out.push((m ? m[1] : s).trim());
  }
  return out.filter(Boolean);
}

