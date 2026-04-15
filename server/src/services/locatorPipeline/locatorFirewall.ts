/**
 * Blocks Playwright / Puppeteer / JS locator API leakage into Katalon Groovy.
 */

const PLAYWRIGHT_LEAK = [
  /\bpage\.getBy/i,
  /\bpage\.locator\s*\(/i,
  /\bdocument\.querySelector/i,
  /\bdriver\.find/i,
  /\.getByRole\s*\(/i,
  /\.getByText\s*\(/i,
  /\.getByTestId\s*\(/i,
  /\.getByLabel\s*\(/i,
  /\.getByPlaceholder\s*\(/i,
  /\.getByAltText\s*\(/i,
  /\bgetByRole\s*\(/i,
  /\bgetByText\s*\(/i,
  /\bgetByTestId\s*\(/i,
  /\bgetByLabel\s*\(/i,
  /\blocator\s*\(\s*['"`]/i,
  /\$\{[^}]*\}/, // template literal in selector string (often JS)
];

/** Object-literal style locator leaking from Playwright options */
const JS_OBJECT_LEAK = /\{\s*name\s*:\s*['"]/i;

export function hasPlaywrightLeakage(text: string): boolean {
  const s = text;
  for (const re of PLAYWRIGHT_LEAK) {
    if (re.test(s)) return true;
  }
  if (JS_OBJECT_LEAK.test(s) && /getByRole|getByLabel|getByText/i.test(s)) return true;
  return false;
}

export function describeLeakageReason(text: string): string | undefined {
  if (/\bpage\.getBy|\.getByRole\s*\(|getByRole\s*\(/i.test(text)) return "Playwright getBy* API";
  if (/\.locator\s*\(|page\.locator/i.test(text)) return "Playwright locator()";
  if (/\bdriver\.|document\.querySelector/i.test(text)) return "Raw WebDriver/DOM API";
  if (/\{\s*name\s*:\s*['"]/i.test(text) && /getByRole/i.test(text)) return "Playwright role options object";
  return undefined;
}
