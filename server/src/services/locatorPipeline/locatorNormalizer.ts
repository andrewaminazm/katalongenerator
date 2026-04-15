/**
 * Ensures RHS resolves to a single Katalon `addProperty` strategy (web + mobile).
 */

export type KatalonPropertyName =
  | "xpath"
  | "css"
  | "name"
  | "id"
  | "accessibility id";

const VALID_PROPS = new Set<string>([
  "xpath",
  "css",
  "name",
  "id",
  "accessibility id",
]);

/**
 * After translation + classification, normalize xpath= prefix and strip illegal chars for Groovy single-quoted strings.
 */
export function normalizePropertyValue(propertyName: KatalonPropertyName, value: string): string {
  let v = value.trim();
  if (propertyName === "xpath") {
    v = v.replace(/^xpath=/i, "").trim();
  }
  return v;
}

export function isAllowedKatalonPropertyName(name: string): boolean {
  return VALID_PROPS.has(name.trim().toLowerCase());
}
