import type { KatalonLocator, SemanticAttributes } from "./attributeResolver.js";
import { resolveBestAttributeCandidate, scoreSemanticLocator } from "./attributeResolver.js";
import { applyContextAwareHeuristics, type LocatorContext } from "./contextAwareLocator.js";
import { mapRoleToXPathElementTests } from "./roleMapper.js";
import { attrEquals, buildTextXPath, buildXPathForElements, orPred, type XpathPredicate } from "./xpathBuilder.js";

export interface SemanticIntent {
  role?: string;
  /** Accessible name (Playwright getByRole options.name) */
  name?: string;
  /** Label text (getByLabel) */
  label?: string;
  /** getByText / visible text */
  text?: string;
  /** getByTestId */
  testId?: string;
  /** getByPlaceholder */
  placeholder?: string;
}

export interface SemanticResult {
  rhs: string;
  locator: KatalonLocator;
  score: number;
  reasons: string[];
}

function toRhs(locator: KatalonLocator): string {
  if (locator.type === "id") return `#${locator.value.replace(/^#/, "")}`;
  if (locator.type === "name") return `name=${locator.value}`;
  if (locator.type === "accessibilityId") return `accessibility id=${locator.value}`;
  if (locator.type === "xpath") return locator.value.startsWith("//") ? locator.value : `xpath=${locator.value}`;
  return locator.value; // css
}

function stableClassToken(className: string | undefined): string | undefined {
  if (!className) return undefined;
  const t = className.split(/\s+/).filter(Boolean)[0];
  if (!t) return undefined;
  // very rough: avoid hashed/tailwind-ish tokens
  if (/^(css-|sc-|_)/i.test(t)) return undefined;
  if (/[A-Z]/.test(t) && t.length > 12) return undefined;
  if (/[0-9]{4,}/.test(t)) return undefined;
  return t;
}

function roleAttrPredicate(attrs: SemanticAttributes): XpathPredicate | undefined {
  const preds: XpathPredicate[] = [];
  if (attrs.name) preds.push(attrEquals("name", attrs.name));
  if (attrs.id) preds.push(attrEquals("id", attrs.id));
  if (attrs.ariaLabel) preds.push(attrEquals("aria-label", attrs.ariaLabel));
  if (attrs.placeholder) preds.push(attrEquals("placeholder", attrs.placeholder));
  if (attrs.testId) preds.push(attrEquals("data-testid", attrs.testId));
  if (preds.length === 0) return undefined;
  return preds.length === 1 ? preds[0] : orPred(preds);
}

/**
 * Converts high-level semantic intent (role/label/text/testId) into ONE Katalon locator RHS string.
 * Always prefers attribute-based strategies; XPath is last resort.
 */
export function semanticLocatorEngine(intent: SemanticIntent, ctx: LocatorContext): SemanticResult | null {
  const reasons: string[] = [];

  const role = intent.role?.trim().toLowerCase();
  const roleEls = mapRoleToXPathElementTests(role);

  // Build semantic attribute bag.
  const attrs: SemanticAttributes = {
    testId: intent.testId?.trim() || undefined,
    placeholder: intent.placeholder?.trim() || undefined,
    ariaLabel: (intent.name?.trim() || intent.label?.trim()) || undefined,
    text: intent.text?.trim() || undefined,
    className: undefined,
  };

  // Context-aware overrides (e.g., Google search q).
  const overrides = applyContextAwareHeuristics(
    { role: role as any, name: intent.name, label: intent.label, text: intent.text },
    ctx
  );
  Object.assign(attrs, overrides);
  if (overrides.name) reasons.push("context: mapped to name attribute");

  // Candidate list ordered by priority, then scored.
  const candidates: { locator: KatalonLocator; bonus: number; why: string }[] = [];

  // Direct attribute selectors (id/name/css) derived from attrs.
  for (const loc of resolveBestAttributeCandidate({
    id: attrs.id,
    name: attrs.name,
    accessibilityId: ctx.platform === "mobile" ? attrs.accessibilityId : undefined,
    ariaLabel: attrs.ariaLabel,
    placeholder: attrs.placeholder,
    testId: attrs.testId,
    className: stableClassToken(attrs.className),
  })) {
    candidates.push({ locator: loc, bonus: 0, why: `attr:${loc.type}` });
  }

  // Role + attribute combo: build an element-scoped XPath using attributes (NOT role text).
  if (roleEls.length > 0) {
    const pred = roleAttrPredicate(attrs);
    if (pred) {
      const xp = buildXPathForElements(roleEls, pred);
      candidates.push({ locator: { type: "xpath", value: xp }, bonus: 8, why: "role+attr xpath" });
    }
  }

  // Role + visible text for button/link only (last-ish; still sometimes best).
  if (intent.text && roleEls.length > 0 && (role === "button" || role === "link")) {
    const el = role === "button" ? "button" : "a";
    candidates.push({
      locator: { type: "xpath", value: buildTextXPath(intent.text.trim(), el) },
      bonus: 4,
      why: "role+text xpath",
    });
  } else if (intent.text && candidates.length === 0) {
    candidates.push({
      locator: { type: "xpath", value: buildTextXPath(intent.text.trim()) },
      bonus: 0,
      why: "text xpath",
    });
  }

  if (candidates.length === 0) return null;

  let best = candidates[0];
  let bestScore = -1;
  for (const c of candidates) {
    const s = scoreSemanticLocator(c.locator) + c.bonus;
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  reasons.push(best.why);
  const rhs = toRhs(best.locator);
  return { rhs, locator: best.locator, score: bestScore, reasons };
}

