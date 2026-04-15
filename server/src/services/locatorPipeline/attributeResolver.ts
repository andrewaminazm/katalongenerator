import { scoreLocator } from "../katalonCompiler/locatorScorer.js";

export type KatalonLocator =
  | { type: "id"; value: string }
  | { type: "name"; value: string }
  | { type: "css"; value: string }
  | { type: "xpath"; value: string }
  | { type: "accessibilityId"; value: string };

export interface SemanticAttributes {
  id?: string;
  name?: string;
  accessibilityId?: string;
  ariaLabel?: string;
  placeholder?: string;
  testId?: string;
  className?: string;
  text?: string;
}

/**
 * Strict attribute prioritization.
 * 1. id
 * 2. name
 * 3. accessibilityId (mobile only; still scored here)
 * 4. aria-label
 * 5. placeholder
 * 6. data-testid
 * 7. class (only if stable)
 * 8. xpath (last)
 */
export function resolveBestAttributeCandidate(attrs: SemanticAttributes): KatalonLocator[] {
  const out: KatalonLocator[] = [];
  if (attrs.id) out.push({ type: "id", value: attrs.id });
  if (attrs.name) out.push({ type: "name", value: attrs.name });
  if (attrs.accessibilityId) out.push({ type: "accessibilityId", value: attrs.accessibilityId });
  if (attrs.ariaLabel) out.push({ type: "css", value: `[aria-label=\"${attrs.ariaLabel.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}\"]` });
  if (attrs.placeholder) out.push({ type: "css", value: `[placeholder=\"${attrs.placeholder.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}\"]` });
  if (attrs.testId) out.push({ type: "css", value: `[data-testid=\"${attrs.testId.replace(/\\/g, "\\\\").replace(/\"/g, "\\\"")}\"]` });
  // className is only usable if it looks stable; caller can decide.
  if (attrs.className) out.push({ type: "css", value: `.${attrs.className.split(/\s+/)[0]}` });
  if (attrs.text) out.push({ type: "xpath", value: `//*[normalize-space()='${attrs.text.replace(/'/g, "\\'")}']` });
  return out;
}

export function scoreSemanticLocator(locator: KatalonLocator): number {
  const kind =
    locator.type === "accessibilityId"
      ? "accessibilityId"
      : (locator.type as "id" | "name" | "css" | "xpath");
  return scoreLocator(kind, locator.value);
}

