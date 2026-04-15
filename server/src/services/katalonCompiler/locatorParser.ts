import { scoreLocator } from "./locatorScorer.js";
import type { LocatorKind, ParsedLocatorLine, ResolvedLocator } from "./types.js";
import { computeSelectorFallbacks } from "../recordingIntelligence/selectorIntelligence.js";
import {
  convertPlaywrightRhsToKatalonSelector,
  type PlaywrightConvertContext,
} from "./playwrightToKatalon.js";

export type { PlaywrightConvertContext };

function slugToVarBase(label: string): string {
  const s = label
    .replace(/[^\w\u0600-\u06FF]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  if (!s.length) return "el";
  const c = s[0];
  if (/[0-9]/.test(c)) return `el_${s}`;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Classify RHS into kind + property + value for Katalon addProperty (single strategy).
 * Playwright DSL (`page.getByRole`, `page.getByLabel`, `page.locator`) is converted first.
 */
export function classifyRhs(rhs: string, ctx?: PlaywrightConvertContext): {
  kind: LocatorKind;
  propertyName: string;
  value: string;
} | null {
  const trimmed = rhs.trim();
  if (!trimmed) return null;

  const converted = convertPlaywrightRhsToKatalonSelector(trimmed, ctx);
  const t = converted ?? trimmed;
  if (!t) return null;

  if (/^[A-Za-z0-9_.\/\-]+$/.test(t) && t.includes("/") && !t.includes("://") && !t.startsWith("//")) {
    return { kind: "orPath", propertyName: "", value: t };
  }

  if (/^xpath=/i.test(t)) {
    return { kind: "xpath", propertyName: "xpath", value: t.replace(/^xpath=/i, "").trim() };
  }
  if (t.startsWith("//") || t.startsWith("(")) {
    return { kind: "xpath", propertyName: "xpath", value: t };
  }

  const acc = t.match(/^accessibility[_\s-]?id\s*=\s*(.+)$/i);
  if (acc) {
    return { kind: "accessibilityId", propertyName: "accessibility id", value: acc[1].trim() };
  }

  if (t.startsWith("#")) {
    return { kind: "id", propertyName: "id", value: t.slice(1) };
  }

  const nameEq = t.match(/^name\s*=\s*(.+)$/i);
  if (nameEq) {
    return { kind: "name", propertyName: "name", value: nameEq[1].trim() };
  }

  if (t.startsWith(".") || t.startsWith("[") || /^[a-zA-Z][\w-]*(\.|#|\[)/.test(t)) {
    return { kind: "css", propertyName: "css", value: t };
  }

  if (/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(t) && !t.includes("/")) {
    return { kind: "name", propertyName: "name", value: t };
  }

  return { kind: "css", propertyName: "css", value: t };
}

export function parseLocatorLines(text: string): ParsedLocatorLine[] {
  const out: ParsedLocatorLine[] = [];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const eq = raw.indexOf("=");
    if (eq < 0) continue;
    const label = raw.slice(0, eq).trim();
    const rhs = raw.slice(eq + 1).trim();
    if (!label || !rhs) continue;
    out.push({ label, rhs, rawLine: raw });
  }
  return out;
}

/**
 * One ResolvedLocator per unique label — highest score wins.
 */
export function resolveLocators(lines: ParsedLocatorLine[], ctx?: PlaywrightConvertContext): ResolvedLocator[] {
  const byLabel = new Map<string, ResolvedLocator>();

  for (const pl of lines) {
    const classified = classifyRhs(pl.rhs, ctx);
    if (!classified) continue;
    if (classified.kind === "orPath") {
      const score = scoreLocator("orPath", classified.value);
      const prev = byLabel.get(pl.label);
      const rl: ResolvedLocator = {
        label: pl.label,
        varBase: slugToVarBase(pl.label),
        kind: "orPath",
        propertyName: "",
        value: classified.value,
        score,
        orPath: classified.value,
      };
      if (!prev || prev.score < score) byLabel.set(pl.label, rl);
      continue;
    }

    const { kind, propertyName, value } = classified;
    const score = scoreLocator(kind, value);
    const prev = byLabel.get(pl.label);
    const fb = computeSelectorFallbacks(value);
    const fallbackProperties = fb.fallbacks.filter(
      (p) => !(p.propertyName === propertyName && p.value === value)
    );
    const candidate: ResolvedLocator = {
      label: pl.label,
      varBase: slugToVarBase(pl.label),
      kind,
      propertyName,
      value,
      score,
      ...(fallbackProperties.length > 0 ? { fallbackProperties } : {}),
    };
    if (!prev || prev.score < score) {
      byLabel.set(pl.label, candidate);
    }
  }

  return [...byLabel.values()].sort((a, b) => a.varBase.localeCompare(b.varBase));
}

/**
 * Build a single ResolvedLocator from a label + RHS (same rules as resolveLocators).
 * Used when OR/fuzzy match fails but we still have a raw selector (e.g. from recording).
 */
export function buildResolvedLocatorFromRhs(
  label: string,
  rhsRaw: string,
  recordingFallback?: boolean,
  ctx?: PlaywrightConvertContext
): ResolvedLocator | null {
  const trimmed = rhsRaw.trim();
  if (!trimmed) return null;

  const classified = classifyRhs(trimmed, ctx);
  if (!classified) {
    return null;
  }

  if (classified.kind === "orPath") {
    const score = scoreLocator("orPath", classified.value);
    return {
      label,
      varBase: slugToVarBase(label),
      kind: "orPath",
      propertyName: "",
      value: classified.value,
      score,
      orPath: classified.value,
      ...(recordingFallback ? { recordingFallback: true } : {}),
    };
  }

  const score = scoreLocator(classified.kind, classified.value);
  const fb = computeSelectorFallbacks(classified.value);
  const fallbackProperties = fb.fallbacks.filter(
    (p) => !(p.propertyName === classified.propertyName && p.value === classified.value)
  );
  return {
    label,
    varBase: slugToVarBase(label),
    kind: classified.kind,
    propertyName: classified.propertyName,
    value: classified.value,
    score,
    ...(fallbackProperties.length ? { fallbackProperties } : {}),
    ...(recordingFallback ? { recordingFallback: true } : {}),
  };
}
