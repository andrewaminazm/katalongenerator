import { normalizeKatalonWebGroovy } from "../groovyLint.js";

/**
 * Deterministic fixes after assembly: casing, web imports, openBrowser overload.
 */
export function autoFixGroovy(code: string, platform: "web" | "mobile"): string {
  let c = code.replace(/\bwebUI\./g, "WebUI.");
  c = c.replace(/\bmobile\./g, "Mobile.");
  if (platform === "web") {
    c = normalizeKatalonWebGroovy(c);
  }
  return c;
}
