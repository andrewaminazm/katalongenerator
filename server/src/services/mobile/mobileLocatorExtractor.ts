import type { MobileUiNode } from "./mobileSourceParser.js";

export type MobileLocatorKind = "resource-id" | "accessibility id" | "text" | "xpath" | "name" | "label";

export interface MobileLocatorLine {
  name: string;
  selector: string;
  kind: MobileLocatorKind;
  confidence: "high" | "medium" | "low";
}

function cleanLabel(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function toSafeName(s: string): string {
  const t = cleanLabel(s);
  if (!t) return "Element";
  return t.length > 48 ? t.slice(0, 48) : t;
}

function pickDisplayLabel(n: MobileUiNode): string {
  return (
    n.contentDesc ||
    n.resourceId ||
    n.text ||
    n.name ||
    n.label ||
    n.value ||
    n.className ||
    n.type ||
    "Element"
  );
}

function normalizeAndroidResourceId(v: string): string {
  return v.trim();
}

function escapeXpathText(s: string): string {
  const t = s.trim();
  if (!t.includes("'")) return `'${t}'`;
  if (!t.includes('"')) return `"${t}"`;
  return `"${t.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function fallbackXpath(n: MobileUiNode): string | null {
  // Very conservative fallback.
  const txt = n.text || n.label || n.name || "";
  const cls = n.className || n.type || "";
  if (!txt.trim()) return null;
  if (cls.trim()) {
    return `//*[@class='${cls}'][contains(@text, ${escapeXpathText(txt)}) or contains(., ${escapeXpathText(txt)})]`;
  }
  return `//*[contains(@text, ${escapeXpathText(txt)}) or contains(., ${escapeXpathText(txt)})]`;
}

export function extractMobileLocatorLines(nodes: MobileUiNode[]): MobileLocatorLine[] {
  const out: MobileLocatorLine[] = [];
  const used = new Set<string>();

  const push = (name: string, selector: string, kind: MobileLocatorKind, confidence: "high" | "medium" | "low") => {
    const key = `${name.toLowerCase()}=${selector}`;
    if (used.has(key)) return;
    used.add(key);
    out.push({ name, selector, kind, confidence });
  };

  for (const n of nodes) {
    const label = toSafeName(pickDisplayLabel(n));

    if (n.platform === "android") {
      if (n.resourceId) {
        push(label, `resource-id=${normalizeAndroidResourceId(n.resourceId)}`, "resource-id", "high");
        continue;
      }
      if (n.contentDesc) {
        push(label, `accessibility id = ${n.contentDesc}`, "accessibility id", "high");
        continue;
      }
      if (n.text) {
        push(label, `text=${n.text}`, "text", "medium");
        const xp = fallbackXpath(n);
        if (xp) push(label, `xpath=${xp}`, "xpath", "low");
        continue;
      }
    }

    if (n.platform === "ios") {
      // Prefer accessibilityId style selectors for iOS.
      if (n.name) {
        push(label, `accessibility id = ${n.name}`, "accessibility id", "high");
        continue;
      }
      if (n.label) {
        push(label, `label=${n.label}`, "label", "medium");
        const xp = fallbackXpath(n);
        if (xp) push(label, `xpath=${xp}`, "xpath", "low");
        continue;
      }
      if (n.value) {
        push(label, `value=${n.value}`, "text", "low");
        const xp = fallbackXpath(n);
        if (xp) push(label, `xpath=${xp}`, "xpath", "low");
        continue;
      }
    }

    // Unknown platform: best-effort.
    if (n.contentDesc) {
      push(label, `accessibility id = ${n.contentDesc}`, "accessibility id", "medium");
      continue;
    }
    if (n.text) {
      push(label, `text=${n.text}`, "text", "low");
      const xp = fallbackXpath(n);
      if (xp) push(label, `xpath=${xp}`, "xpath", "low");
    }
  }

  return out;
}

