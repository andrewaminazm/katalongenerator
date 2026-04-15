import { hasPlaywrightLeakage } from "./locatorFirewall.js";
import { isAllowedKatalonPropertyName } from "./locatorNormalizer.js";

/**
 * Validates a single addProperty(property, ConditionType.EQUALS, value) before emission.
 */
export function isValidTestObjectLocator(propertyName: string, value: string): boolean {
  const p = propertyName.trim().toLowerCase();
  if (!isAllowedKatalonPropertyName(propertyName)) {
    return false;
  }
  if (!value || value.trim().length === 0) {
    return false;
  }
  if (hasPlaywrightLeakage(value)) {
    return false;
  }
  // Hard block: role words must never appear as locator content (avoids role-as-text bugs).
  if (/\b(textbox|searchbox|button|link|checkbox|radio|combobox)\b/i.test(value)) {
    return false;
  }
  if (/[\n\r]/.test(value)) {
    return false;
  }
  if (p === "xpath" && (value.includes("getByRole") || value.includes("page."))) {
    return false;
  }
  if (p === "xpath" && /contains\s*\(\s*text\s*\(\s*\)\s*,/i.test(value)) {
    // Usually unstable and often indicates semantic leakage.
    return false;
  }
  return true;
}
