import type { ResolvedLocator } from "../katalonCompiler/types.js";

function toCamel(s: string): string {
  const cleaned = s.replace(/[^\w\u0600-\u06FF]+/g, " ").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "el";
  const [first, ...rest] = parts;
  return (
    first.toLowerCase() +
    rest.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("")
  );
}

function looksLikeSearch(locator: ResolvedLocator): boolean {
  const blob = `${locator.label} ${locator.value}`.toLowerCase();
  if (/\bsearch\b|\bquery\b|\bmagnif\b/.test(blob)) return true;
  if (locator.kind === "name" && locator.value.trim() === "q") return true;
  return false;
}

function looksLikePassword(locator: ResolvedLocator): boolean {
  const blob = `${locator.label} ${locator.value}`.toLowerCase();
  return /\bpass(word)?\b/.test(blob) || /type=['"]password['"]/.test(blob);
}

function looksLikeUsername(locator: ResolvedLocator): boolean {
  const blob = `${locator.label} ${locator.value}`.toLowerCase();
  return /\b(user(name)?|email|login)\b/.test(blob);
}

export function improveLocatorVarBases(locs: ResolvedLocator[]): ResolvedLocator[] {
  return locs.map((l) => {
    if (l.kind === "orPath") return l;

    // Preserve existing stable varBase unless it is generic.
    const generic = /^el(_\d+)?$/i.test(l.varBase) || /^unknown/i.test(l.varBase);

    let proposed: string | null = null;
    if (looksLikeSearch(l)) proposed = l.kind === "name" || l.kind === "xpath" || l.kind === "css" ? "searchInput" : "search";
    else if (looksLikePassword(l)) proposed = "passwordField";
    else if (looksLikeUsername(l)) proposed = "usernameField";
    else if (/\bsubmit|login|sign\s*in\b/i.test(l.label)) proposed = "loginButton";

    if (!proposed) return l;
    if (!generic && l.varBase.length >= 4) return l;
    return { ...l, varBase: toCamel(proposed) };
  });
}

