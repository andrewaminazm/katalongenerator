/**
 * Maps selectors + interaction type to stable, readable TestObject-style labels (t*PascalCase + role).
 */

const USED = new Set<string>();

export function resetSemanticNameRegistry(): void {
  USED.clear();
}

function toPascalCase(s: string): string {
  const parts = s
    .replace(/[^\w\u0600-\u06FF]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "Control";
  return parts
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

export type ElementRole = "Button" | "Input" | "Link" | "Field" | "Control";

export function inferElementRole(selector: string, action: string): ElementRole {
  const s = `${selector} ${action}`.toLowerCase();
  if (/\b(btn|button|submit|sign\s*in|login)\b/i.test(s)) return "Button";
  if (/\b(link|href)\b/i.test(s) || /role\s*=\s*link/i.test(s)) return "Link";
  if (/\b(input|textarea|search|textbox|q\b|query)\b/i.test(s)) return "Input";
  if (/\b(fill|type|settext|enter)\b/i.test(action.toLowerCase())) return "Input";
  if (/\bclick\b/i.test(action) && /nav|menu|tab/i.test(s)) return "Button";
  return "Control";
}

/**
 * Produces labels like `tSearchInput`, `tLoginButton` — never bare "element".
 */
export function buildRecordingTestObjectLabel(
  selector: string,
  action: string,
  used: Set<string> = USED
): string {
  const hint = extractLabelHint(selector);
  const role = inferElementRole(selector, action);
  const base = toPascalCase(hint) || "Ui";
  let name = `t${base}${role}`;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `t${base}${role}${n}`;
    n++;
  }
  used.add(name.toLowerCase());
  return name;
}

function extractLabelHint(selector: string): string {
  const s = selector.trim();
  const id = /^#([\w-:.]+)$/.exec(s);
  if (id) return id[1];
  const nm = /\[name\s*=\s*["']([^"']+)["']\s*\]/i.exec(s);
  if (nm) return nm[1];
  const dt = /\[data-testid\s*=\s*["']([^"']+)["']\s*\]/i.exec(s);
  if (dt) return dt[1];
  const xp = /(?:@id|@name)\s*=\s*["']([^"']+)["']/i.exec(s);
  if (xp) return xp[1];
  const cls = /^[a-zA-Z][\w-]*\.([\w-]+)$/.exec(s);
  if (cls) return cls[1];
  return s.replace(/^xpath=/i, "").replace(/[^\w]+/g, " ").trim().slice(0, 32) || "control";
}
