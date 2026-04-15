export { hasPlaywrightLeakage, describeLeakageReason } from "./locatorFirewall.js";
export { translateLocatorRhs, type LocatorTranslateContext } from "./locatorTranslator.js";
export {
  normalizePropertyValue,
  isAllowedKatalonPropertyName,
  type KatalonPropertyName,
} from "./locatorNormalizer.js";
export { isValidTestObjectLocator } from "./testObjectValidator.js";
export {
  sanitizeKatalonLocatorLines,
  stripPlaywrightLeakageFromGroovy,
  type SanitizeLocatorResult,
} from "./autoFixLocatorEngine.js";
export { semanticLocatorEngine } from "./semanticLocatorEngine.js";
