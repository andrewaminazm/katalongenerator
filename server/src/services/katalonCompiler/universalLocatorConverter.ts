import { parseLocatorLines } from "./locatorParser.js";
import {
  convertPlaywrightRhsToKatalonSelector,
  isPlaywrightLocatorRhs,
} from "./playwrightToKatalon.js";

export type LocatorConversionConfidence = "high" | "medium" | "low";

export interface ConvertedLocatorItem {
  label: string;
  type: "css" | "xpath";
  value: string;
  confidence: LocatorConversionConfidence;
  original: string;
  /** When present, conversion used fallback */
  error?: string;
}

function xpathQuoteForContains(text: string): string {
  if (!text.includes("'")) return `'${text}'`;
  if (!text.includes('"')) return `"${text}"`;
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function inferCssOrXpath(value: string): "css" | "xpath" {
  const v = value.trim();
  if (v.startsWith("//") || v.startsWith("(") || /^xpath=/i.test(v)) return "xpath";
  return "css";
}

/** Reject strings that still look like framework DSL after conversion. */
export function isKatalonOnlySelector(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/page\.(getBy|locator)\s*\(/i.test(v)) return false;
  if (/\bBy\.(id|xpath|cssSelector|name|className|tagName|linkText|partialLinkText)\s*\(/i.test(v)) {
    return false;
  }
  if (/\bcy\.(get|contains|xpath)\s*\(/i.test(v)) return false;
  return true;
}

function isProbablyRawKatalonSelector(rhs: string): boolean {
  const t = rhs.trim();
  if (!t) return false;
  if (t.startsWith("page.")) return false;
  if (isPlaywrightLocatorRhs(t)) return false;
  if (/\bBy\./i.test(t) || /\bcy\./i.test(t)) return false;
  return (
    t.startsWith("#") ||
    t.startsWith(".") ||
    t.startsWith("[") ||
    t.startsWith("//") ||
    t.startsWith("(") ||
    /^xpath=/i.test(t) ||
    (/^[a-zA-Z][\w-]*(\[|\.|#)/.test(t) && !/^page\./i.test(t))
  );
}

/** Map internal `name=q` style to display CSS for API / textarea. */
function normalizePlaywrightResultToCssOrXpath(s: string): { value: string; type: "css" | "xpath" } {
  const t = s.trim();
  if (/^name\s*=\s*(.+)$/i.test(t)) {
    const m = t.match(/^name\s*=\s*(.+)$/i);
    const name = (m?.[1] ?? "").trim().replace(/'/g, "\\'");
    return { value: `input[name='${name}']`, type: "css" };
  }
  if (t.startsWith("//") || t.startsWith("(")) return { value: t, type: "xpath" };
  return { value: t, type: inferCssOrXpath(t) };
}

function tryConvertSelenium(rhs: string): { value: string; type: "css" | "xpath" } | null {
  const t = rhs.replace(/\s+/g, " ").trim();

  const id = t.match(/By\.id\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (id) return { value: `#${id[1]}`, type: "css" };

  const css = t.match(/By\.cssSelector\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (css) return { value: css[1], type: inferCssOrXpath(css[1]) };

  const xp = t.match(/By\.xpath\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (xp) return { value: xp[1].trim(), type: "xpath" };

  const nm = t.match(/By\.name\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (nm) return { value: `*[name='${nm[1]}']`, type: "css" };

  const cn = t.match(/By\.className\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (cn) {
    const c = cn[1].replace(/^\.+/, "");
    return { value: `.${c}`, type: "css" };
  }

  const tn = t.match(/By\.tagName\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (tn) return { value: tn[1].toLowerCase(), type: "css" };

  const lt = t.match(/By\.linkText\s*\(\s*["']([^"']+)["']\s*\)/i);
  if (lt) {
    const q = xpathQuoteForContains(lt[1]);
    return { value: `//a[contains(normalize-space(.),${q})]`, type: "xpath" };
  }

  return null;
}

function tryConvertCypress(rhs: string): { value: string; type: "css" | "xpath"; confidence: LocatorConversionConfidence } | null {
  const t = rhs.replace(/\s+/g, " ").trim();

  const getChain = t.match(/cy\.get\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (getChain) {
    const inner = getChain[1].trim();
    if (inner.startsWith("//") || inner.startsWith("(")) return { value: inner, type: "xpath", confidence: "high" };
    return { value: inner, type: "css", confidence: "high" };
  }

  const contains = t.match(/cy\.contains\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (contains) {
    const q = xpathQuoteForContains(contains[1]);
    return {
      value: `//*[contains(normalize-space(.),${q})]`,
      type: "xpath",
      confidence: "medium",
    };
  }

  const cx = t.match(/cy\.xpath\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (cx) return { value: cx[1].trim(), type: "xpath", confidence: "high" };

  return null;
}

function fallbackXPathForLabel(label: string): string {
  const q = xpathQuoteForContains(label.trim() || "element");
  return `//*[contains(normalize-space(.),${q})]`;
}

export function convertRhsToKatalon(
  rhs: string,
  ctx?: { pageUrl?: string; labelHint?: string }
): { value: string; type: "css" | "xpath"; confidence: LocatorConversionConfidence; via: string } {
  const raw = rhs.trim();
  if (!raw) {
    return { value: "//body", type: "xpath", confidence: "low", via: "empty" };
  }

  if (isPlaywrightLocatorRhs(raw)) {
    const pw = convertPlaywrightRhsToKatalonSelector(raw, ctx);
    if (pw) {
      const norm = normalizePlaywrightResultToCssOrXpath(pw);
      return { value: norm.value, type: norm.type, confidence: "high", via: "playwright" };
    }
  }

  const se = tryConvertSelenium(raw);
  if (se) {
    return { value: se.value, type: se.type, confidence: "high", via: "selenium" };
  }

  const cy = tryConvertCypress(raw);
  if (cy) {
    return { value: cy.value, type: cy.type, confidence: cy.confidence, via: "cypress" };
  }

  if (isProbablyRawKatalonSelector(raw) && isKatalonOnlySelector(raw)) {
    return {
      value: raw,
      type: inferCssOrXpath(raw),
      confidence: "high",
      via: "passthrough",
    };
  }

  const hint = ctx?.labelHint?.trim() || raw.slice(0, 120);
  const fb = fallbackXPathForLabel(hint);
  return { value: fb, type: "xpath", confidence: "low", via: "fallback" };
}

/**
 * Convert mixed locator lines (`Label = rhs`) to Katalon-only CSS/XPath. Deduplicates by label (last wins).
 */
export function convertLocatorLines(
  inputLines: string[],
  ctx?: { pageUrl?: string }
): {
  results: ConvertedLocatorItem[];
  lines: string;
  errors: { label: string; message: string }[];
} {
  const errors: { label: string; message: string }[] = [];
  const resultsOrdered: ConvertedLocatorItem[] = [];
  const indexByLabel = new Map<string, number>();

  for (const line of inputLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const parsed = parseLocatorLines(trimmed);
    if (parsed.length === 0) {
      errors.push({ label: trimmed.slice(0, 40), message: "Expected Label = selector" });
      continue;
    }

    const pl = parsed[0];
    const label = pl.label.trim();
    const original = pl.rhs.trim();

    const conv = convertRhsToKatalon(original, { ...ctx, labelHint: label });
    let value = conv.value;
    let confidence = conv.confidence;
    let errNote: string | undefined;

    if (!isKatalonOnlySelector(value)) {
      value = fallbackXPathForLabel(label);
      confidence = "low";
      errNote = "Output still contained framework DSL; applied label-based XPath fallback.";
      errors.push({ label, message: errNote });
    }

    const item: ConvertedLocatorItem = {
      label,
      type: inferCssOrXpath(value),
      value,
      confidence,
      original: `${label} = ${original}`,
      ...(errNote ? { error: errNote } : {}),
    };

    const key = label.toLowerCase();
    const idx = indexByLabel.get(key);
    if (idx !== undefined) {
      resultsOrdered[idx] = item;
    } else {
      indexByLabel.set(key, resultsOrdered.length);
      resultsOrdered.push(item);
    }
  }

  const lines = resultsOrdered.map((r) => `${r.label} = ${r.value}`).join("\n");

  return { results: resultsOrdered, lines, errors };
}
