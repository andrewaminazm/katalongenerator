function toCamelCase(words: string[]): string {
  if (words.length === 0) return "el";
  const [first, ...rest] = words;
  const f = first.toLowerCase();
  return f + rest.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("");
}

function tokenize(raw: string): string[] {
  const cleaned = raw
    .replace(/["'“”]/g, " ")
    .replace(/[^\w\u0600-\u06FF]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.split(" ").filter(Boolean);
}

function hasAny(s: string, re: RegExp): boolean {
  return re.test(s.toLowerCase());
}

/**
 * Convert any user hint ("Login button", "username field", "Search") into a semantic target name.
 * Never returns raw text; always returns a stable camelCase identifier.
 */
export function resolveSemanticTarget(rawHint: string): string {
  const raw = (rawHint || "").trim();
  if (!raw) return "el";
  const lower = raw.toLowerCase();

  // Common explicit mappings
  if (/\b(username|user\s*name|email|login\s*id)\b/i.test(lower)) return "usernameField";
  if (/\bpassword|pass\s*code\b/i.test(lower)) return "passwordField";
  if (/\bsearch\b|\bquery\b/i.test(lower)) return "searchInput";
  if (/\blogin\b|\bsign\s*in\b/i.test(lower) && /\bbutton\b/i.test(lower)) return "loginButton";

  const isButton = hasAny(lower, /\b(button|btn|submit|sign\s*in|login)\b/);
  const isField = hasAny(lower, /\b(field|input|textbox|text\s*box|box)\b/);
  const isLink = hasAny(lower, /\b(link)\b/);
  const isDropdown = hasAny(lower, /\b(dropdown|select|combo|combobox)\b/);

  const words = tokenize(raw).filter((w) => !/^(the|a|an|on|in|at|to|for|and|or|of)$/i.test(w));
  const base = toCamelCase(words.slice(0, 4));

  if (isButton) return base.endsWith("Button") ? base : `${base}Button`;
  if (isDropdown) return base.endsWith("Select") ? base : `${base}Select`;
  if (isLink) return base.endsWith("Link") ? base : `${base}Link`;
  if (isField) return base.endsWith("Field") ? base : `${base}Field`;
  return base;
}

