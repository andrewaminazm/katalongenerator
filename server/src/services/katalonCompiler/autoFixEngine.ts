import { normalizeKatalonWebGroovy } from "../groovyLint.js";

/**
 * Deterministic fixes after assembly: casing, web imports, openBrowser overload.
 */
export function autoFixGroovy(code: string, platform: "web" | "mobile"): string {
  let c = code.replace(/\bwebUI\./g, "WebUI.");
  // Only fix keyword calls like `mobile.tap(...)` → `Mobile.tap(...)`.
  // Do NOT rewrite import package segments like `com.kms.katalon.core.mobile.keyword...`.
  c = c.replace(/(?<!core\.)\bmobile\./g, "Mobile.");
  if (platform === "web") {
    c = normalizeKatalonWebGroovy(c);
  }
  return c;
}
