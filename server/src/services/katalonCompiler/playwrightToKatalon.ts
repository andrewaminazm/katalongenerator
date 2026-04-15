/**
 * Converts Playwright locator DSL strings into Katalon-compatible CSS or XPath.
 * Raw Playwright must never be passed to TestObject.addProperty.
 */

export interface PlaywrightConvertContext {
  /** Page URL from the tool (used for google.com search box special case). */
  pageUrl?: string;
}

function isGoogleHost(url?: string): boolean {
  if (!url?.trim()) return false;
  const s = url.trim();
  try {
    const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
    const host = new URL(withProto).hostname.toLowerCase().replace(/^www\./, "");
    return host === "google.com" || host.endsWith(".google.com");
  } catch {
    return /google\.com/i.test(s);
  }
}

/** String literal for XPath `contains(@attr, ...)` / `normalize-space`. */
function xpathQuoteForContains(text: string): string {
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function extractQuotedFirstArg(callBody: string): { quote: string; value: string; rest: string } | null {
  const m = callBody.match(/^\s*(['"`])([\s\S]*?)\1/);
  if (!m) return null;
  return { quote: m[1], value: m[2], rest: callBody.slice(m[0].length) };
}

/**
 * Parse `name: "Search"` / `name: 'x'` / `name: `x`` from options object fragment.
 */
function extractNameOption(optionsFragment: string): string | undefined {
  const m = optionsFragment.match(/name\s*:\s*(['"`])([\s\S]*?)\1/);
  if (m) return m[2];
  return undefined;
}

function xpathFallbackForAccessibleName(name: string): string {
  const q = xpathQuoteForContains(name);
  return `//*[contains(normalize-space(.),${q})]`;
}

function getByRoleToXPath(role: string, accessibleName: string | undefined): string {
  const r = role.toLowerCase();
  const name = accessibleName?.trim();

  if (!name) {
    return `//*[@role='${r.replace(/'/g, "\\'")}']`;
  }

  const nq = xpathQuoteForContains(name);

  if (r === "textbox" || r === "searchbox") {
    return `//input[@type='text' or @type='search' or @role='textbox' or @role='searchbox'][contains(@aria-label,${nq}) or contains(@name,${nq}) or contains(@placeholder,${nq})]`;
  }

  if (r === "button" || r === "link") {
    const tag = r === "link" ? "a" : "button";
    return `//${tag}[contains(normalize-space(.),${nq}) or contains(@aria-label,${nq})]`;
  }

  return `//*[@role='${r}'][contains(@aria-label,${nq}) or contains(normalize-space(.),${nq})]`;
}

/** getByLabel → attribute / text heuristics (valid XPath 1.0). */
function getByLabelToXPathSimple(label: string): string {
  const q = xpathQuoteForContains(label.trim());
  return `//*[contains(@aria-label,${q}) or contains(@placeholder,${q}) or contains(@name,${q}) or contains(normalize-space(.),${q})]`;
}

function extractLocatorFromPageLocator(rhs: string): string | null {
  const m = rhs.trim().match(/^page\.locator\s*\(\s*(['"`])([\s\S]*?)\1\s*\)\s*$/i);
  if (!m) return null;
  return m[2].trim();
}

function extractGetByRole(rhs: string): { role: string; rest: string } | null {
  const m = rhs.trim().match(/^page\.getByRole\s*\(\s*/i);
  if (!m) return null;
  const after = rhs.trim().slice(m[0].length);
  const first = extractQuotedFirstArg(after);
  if (!first) return null;
  return { role: first.value, rest: first.rest };
}

function extractGetByLabel(rhs: string): string | null {
  const m = rhs.trim().match(/^page\.getByLabel\s*\(\s*(['"`])([\s\S]*?)\1/i);
  if (!m) return null;
  return m[2];
}

export function isPlaywrightLocatorRhs(rhs: string): boolean {
  const t = rhs.trim();
  return /page\.(getByRole|getByLabel|locator)\s*\(/i.test(t);
}

/**
 * Returns a Katalon selector string (CSS, XPath, or `name=value` for name strategy),
 * or `null` if the RHS is not Playwright DSL.
 */
export function convertPlaywrightRhsToKatalonSelector(
  rhs: string,
  ctx?: PlaywrightConvertContext
): string | null {
  const raw = rhs.trim();
  if (!isPlaywrightLocatorRhs(raw)) return null;

  // page.locator('#x') → inner selector only
  const locInner = extractLocatorFromPageLocator(raw);
  if (locInner !== null) {
    const out =
      locInner.startsWith("//") || locInner.startsWith("(")
        ? locInner
        : /^xpath=/i.test(locInner)
          ? locInner.replace(/^xpath=/i, "").trim()
          : locInner;
    console.log("Converted Playwright locator →", out);
    return out;
  }

  const gbr = extractGetByRole(raw);
  if (gbr) {
    const nameOpt = extractNameOption(gbr.rest);
    const roleLower = gbr.role.trim().toLowerCase();

    if (isGoogleHost(ctx?.pageUrl) && (roleLower === "textbox" || roleLower === "searchbox")) {
      const out = "name=q";
      console.log("Converted Playwright locator →", out);
      return out;
    }

    if (isGoogleHost(ctx?.pageUrl) && roleLower === "button" && nameOpt) {
      const n = nameOpt.toLowerCase();
      if (/\bgoogle\s*search\b/.test(n) || (n.includes("google") && n.includes("search"))) {
        const out = "input[name='btnK']";
        console.log("Converted Playwright locator →", out);
        return out;
      }
    }

    const xpath = getByRoleToXPath(gbr.role, nameOpt);
    console.log("Converted Playwright locator →", xpath);
    return xpath;
  }

  const gbl = extractGetByLabel(raw);
  if (gbl !== undefined && gbl !== null) {
    const xpath = getByLabelToXPathSimple(gbl);
    console.log("Converted Playwright locator →", xpath);
    return xpath;
  }

  const fallback = xpathFallbackForAccessibleName(extractNameOption(raw) ?? "element");
  console.log("Converted Playwright locator →", fallback);
  return fallback;
}
