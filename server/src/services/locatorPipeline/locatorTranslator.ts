import { semanticLocatorEngine, type SemanticIntent } from "./semanticLocatorEngine.js";

export interface LocatorTranslateContext {
  platform: "web" | "mobile";
  url?: string;
}

function stripPagePrefix(s: string): string {
  return s.replace(/^\s*(?:this\.)?page\./i, "");
}

function stripOuterParens(s: string): string {
  const t = s.trim();
  if (t.startsWith("(") && t.endsWith(")")) return t.slice(1, -1).trim();
  return t;
}

function parsePlaywrightIntent(input: string): SemanticIntent | null {
  const s = stripOuterParens(stripPagePrefix(input.trim()));

  // getByRole('textbox', { name: 'Search' })
  const roleWithName = s.match(
    /getByRole\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{\s*name\s*:\s*['"]([^'"]+)['"]\s*\}\s*\)/i
  );
  if (roleWithName) {
    return { role: roleWithName[1], name: roleWithName[2] };
  }

  const roleOnly = s.match(/getByRole\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (roleOnly) {
    return { role: roleOnly[1] };
  }

  const byTestId = s.match(/getByTestId\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (byTestId) return { testId: byTestId[1] };

  const byLabel = s.match(/getByLabel\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (byLabel) return { label: byLabel[1] };

  const byPlaceholder = s.match(/getByPlaceholder\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (byPlaceholder) return { placeholder: byPlaceholder[1] };

  const byText = s.match(/getByText\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (byText) return { text: byText[1] };

  return null;
}

/**
 * Deterministic Playwright-style expressions → Katalon-safe CSS/XPath/name/id strings.
 * Semantic mapping (role/label/text) is handled by `semanticLocatorEngine`.
 */
export function translateLocatorRhs(rhs: string, ctx: LocatorTranslateContext): string {
  let s = stripPagePrefix(rhs.trim());

  // Unwrap locator('selector') / page.locator("...")
  const locatorCall = s.match(/(?:^|\.|\b)locator\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (locatorCall) {
    return locatorCall[1].trim();
  }

  const intent = parsePlaywrightIntent(s);
  if (intent) {
    const sem = semanticLocatorEngine(intent, ctx);
    if (sem?.rhs) return sem.rhs;
  }

  // Fallback: return as-is; firewall+autofix will handle or drop.
  return s.trim();
}
