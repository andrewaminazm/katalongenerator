import { isLikelyDynamicId } from "../katalonCompiler/locatorScorer.js";
import type { HealingLocatorType } from "./types.js";

const BASE: Record<string, number> = {
  id: 100,
  name: 90,
  "data-testid": 95,
  accessibilityId: 95,
  css: 70,
  xpath: 50,
};

/**
 * Self-healing candidate scores (rule-based + memory). AI suggestions re-scored here for ordering.
 */
export function scoreHealingCandidate(type: HealingLocatorType | string, value: string): number {
  const t = type as HealingLocatorType;
  let s = BASE[t] ?? 55;
  const v = value.trim();

  if (t === "id" && isLikelyDynamicId(v.startsWith("#") ? v.slice(1) : v)) {
    s -= 45;
  }
  if (v.length > 140) s -= 18;
  else if (v.length > 90) s -= 10;

  if (t === "css") {
    if (/nth-child|nth-of-type/i.test(v)) s -= 12;
    if (/\.css-|\.sc-|_[a-z0-9]{5,}/i.test(v)) s -= 20;
  }
  if (t === "xpath" && /^\/html/i.test(v)) s -= 12;

  return Math.max(0, Math.min(100, s));
}
