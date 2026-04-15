import type { FailureReport, HealingErrorType, LocatorRef } from "./types.js";

const ERROR_TYPES = new Set<HealingErrorType>([
  "NOT_FOUND",
  "TIMEOUT",
  "CLICK_INTERCEPTED",
  "UNKNOWN",
]);

function isLocatorRef(v: unknown): v is LocatorRef {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.type === "string" && typeof o.value === "string";
}

/**
 * Validates and normalizes a client POST body into a FailureReport.
 */
export function normalizeFailureReport(body: unknown): FailureReport | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const nested =
    o.failure && typeof o.failure === "object" ? (o.failure as Record<string, unknown>) : o;
  const stepId = String(nested.stepId ?? nested.step_id ?? o.stepId ?? o.step_id ?? "").trim();
  const action = String(nested.action ?? o.action ?? "").trim();
  const failedLocator = nested.failedLocator ?? nested.failed_locator ?? o.failedLocator ?? o.failed_locator;
  if (!stepId || !action || !isLocatorRef(failedLocator)) {
    return null;
  }
  let errorType: HealingErrorType = "UNKNOWN";
  const et = String(nested.errorType ?? nested.error_type ?? o.errorType ?? o.error_type ?? "UNKNOWN").toUpperCase();
  if (ERROR_TYPES.has(et as HealingErrorType)) {
    errorType = et as HealingErrorType;
  }
  return {
    stepId,
    action,
    failedLocator: {
      type: failedLocator.type.trim(),
      value: failedLocator.value.trim(),
    },
    errorType,
    screenshot:
      typeof nested.screenshot === "string"
        ? nested.screenshot
        : typeof o.screenshot === "string"
          ? o.screenshot
          : undefined,
    domSnapshot:
      typeof nested.domSnapshot === "string"
        ? nested.domSnapshot
        : typeof nested.dom_snapshot === "string"
          ? nested.dom_snapshot
          : typeof o.domSnapshot === "string"
            ? o.domSnapshot
            : typeof o.dom_snapshot === "string"
              ? o.dom_snapshot
              : undefined,
  };
}

/**
 * Map Playwright / string errors to HealingErrorType.
 */
export function classifyErrorMessage(message: string): HealingErrorType {
  const m = message.toLowerCase();
  if (/timeout|timed out|waiting failed/i.test(m)) return "TIMEOUT";
  if (/not visible|not found|no node|strict mode violation|element is not attached/i.test(m)) {
    return "NOT_FOUND";
  }
  if (/intercept|obscured|covered|click.*did not/i.test(m)) return "CLICK_INTERCEPTED";
  return "UNKNOWN";
}
