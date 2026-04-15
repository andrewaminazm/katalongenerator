/**
 * Locator strategy ordering: id > name > css > xpath (fallbacks for Katalon TestObject.addProperty).
 */

export interface SelectorProperty {
  propertyName: string;
  value: string;
}

/**
 * Primary strategy (highest priority) + ordered fallback properties for the same element.
 */
export function computeSelectorFallbacks(rawSelector: string): {
  primary: SelectorProperty;
  fallbacks: SelectorProperty[];
} {
  const t = rawSelector.trim();
  const fallbacks: SelectorProperty[] = [];

  if (!t) {
    return { primary: { propertyName: "css", value: "*" }, fallbacks: [] };
  }

  if (t.startsWith("#")) {
    const id = t.slice(1);
    return {
      primary: { propertyName: "id", value: id },
      fallbacks: [{ propertyName: "css", value: t }],
    };
  }

  const nameM = t.match(/^\[name\s*=\s*["']([^"']+)["']\s*\]$/i);
  if (nameM) {
    const v = nameM[1];
    fallbacks.push({ propertyName: "name", value: v });
    fallbacks.push({ propertyName: "css", value: t });
    return { primary: { propertyName: "name", value: v }, fallbacks: dedupeProps(fallbacks) };
  }

  if (/^xpath=/i.test(t) || t.startsWith("//") || t.startsWith("(")) {
    const xv = t.replace(/^xpath=/i, "").trim();
    return { primary: { propertyName: "xpath", value: xv }, fallbacks: [] };
  }

  if (t.startsWith(".") || t.startsWith("[") || /^[a-zA-Z][\w-]*/.test(t)) {
    fallbacks.push({ propertyName: "css", value: t });
    return { primary: { propertyName: "css", value: t }, fallbacks: dedupeProps(fallbacks) };
  }

  return { primary: { propertyName: "css", value: t }, fallbacks: [] };
}

function dedupeProps(props: SelectorProperty[]): SelectorProperty[] {
  const seen = new Set<string>();
  const out: SelectorProperty[] = [];
  for (const p of props) {
    const k = `${p.propertyName}::${p.value}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}
