import type { LocatorKind } from "./types.js";

const BASE_SCORE: Record<LocatorKind, number> = {
  id: 100,
  name: 90,
  accessibilityId: 95,
  resourceId: 97,
  css: 70,
  xpath: 50,
  orPath: 85,
};

/** Heuristic: random-looking short ids (e.g. Google dynamic ids). */
export function isLikelyDynamicId(value: string): boolean {
  const v = value.replace(/^#/, "").trim();
  if (v.length < 4 || v.length > 64) return false;
  if (/^[0-9a-f]{8}-[0-9a-f-]{36}$/i.test(v)) return true;
  if (/^gb_|^rc_|^jsc_/i.test(v)) return true;
  if (/^[a-z]{1,3}_[a-z0-9]{6,}$/i.test(v)) return true;
  if (/^[a-z0-9]{12,}$/i.test(v) && !/[A-Z]/.test(v)) return true;
  return false;
}

export function isUnstableClassToken(token: string): boolean {
  const t = token.replace(/^\./, "");
  return /^css-|^[a-z]+-[a-z0-9]{4,}$/i.test(t) || /^sc-|^_/.test(t);
}

/**
 * Returns numeric score; higher is better. Same kind+value should get same score for stability.
 */
export function scoreLocator(kind: LocatorKind, rawValue: string): number {
  let s = BASE_SCORE[kind] ?? 50;
  const v = rawValue.trim();

  if (kind === "id" && isLikelyDynamicId(v)) {
    s -= 45;
  }
  if (v.length > 140) {
    s -= 20;
  } else if (v.length > 80) {
    s -= 10;
  }

  if (kind === "css") {
    const parts = v.split(/\s+/);
    if (parts.some((p) => isUnstableClassToken(p))) {
      s -= 25;
    }
    if (/nth-child|nth-of-type/i.test(v)) {
      s -= 15;
    }
  }

  if (kind === "xpath") {
    if (/^\/html/i.test(v) || /^\/\//.test(v) && v.length > 200) {
      s -= 15;
    }
  }

  return Math.max(0, Math.min(100, s));
}
