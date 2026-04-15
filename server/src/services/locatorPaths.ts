/**
 * Pull likely Object Repository paths from "label = rhs" locator lines
 * when RHS looks like Page_Foo/bar (not CSS / xpath).
 */
export function extractOrPathsFromLocatorLines(locatorsText: string): string[] {
  const out = new Set<string>();
  for (const line of locatorsText.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const rhs = t.slice(eq + 1).trim();
    if (!rhs) continue;
    if (/^#|^\.|^\[|^xpath=|^\/\//i.test(rhs)) continue;
    if (rhs.includes("://")) continue;
    if (/^[A-Za-z0-9_./\-]+$/.test(rhs) && rhs.includes("/")) {
      out.add(rhs.replace(/\/+$/, ""));
    }
  }
  return [...out];
}
