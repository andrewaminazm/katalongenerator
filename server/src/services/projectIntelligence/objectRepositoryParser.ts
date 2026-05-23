import { XMLParser } from "fast-xml-parser";
import type { ParsedTestObject, SelectorType } from "./types.js";

function inferSelectorType(value: string, key?: string): SelectorType {
  const k = (key ?? "").toUpperCase();
  const v = value.trim();
  if (k.includes("XPATH") || v.startsWith("//") || v.startsWith("(")) return "XPATH";
  if (k.includes("CSS") || v.startsWith("#") || v.startsWith(".")) return "CSS";
  if (k === "BASIC" || k === "ID") return v.startsWith("#") ? "CSS" : "BASIC";
  if (k === "NAME") return "NAME";
  return "UNKNOWN";
}

function collectSelectorEntries(parsed: unknown): { key: string; value: string }[] {
  const out: { key: string; value: string }[] = [];
  if (!parsed || typeof parsed !== "object") return out;

  const walk = (node: unknown, depth: number): void => {
    if (depth > 30 || node === null || node === undefined) return;
    if (typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x, depth + 1);
      return;
    }
    const o = node as Record<string, unknown>;
    if (o.selectorCollection && typeof o.selectorCollection === "object") {
      const sc = o.selectorCollection as Record<string, unknown>;
      const entries = sc.entry;
      const list = Array.isArray(entries) ? entries : entries ? [entries] : [];
      for (const e of list) {
        if (!e || typeof e !== "object") continue;
        const ent = e as Record<string, unknown>;
        const key = String(ent.key ?? ent["@_key"] ?? "").trim();
        const value = String(ent.value ?? ent["@_value"] ?? "").trim();
        if (value) out.push({ key: key || "BASIC", value });
      }
    }
    for (const v of Object.values(o)) walk(v, depth + 1);
  };

  walk(parsed, 0);
  return out;
}

function entityName(parsed: unknown, xml: string): string {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const root = parsed as Record<string, unknown>;
    const entity = root.WebElementEntity ?? root.webElementEntity;
    if (entity && typeof entity === "object" && !Array.isArray(entity)) {
      const n = (entity as Record<string, unknown>).name;
      if (typeof n === "string" && n.trim()) return n.trim();
    }
  }
  const m = xml.match(/<name>([^<]+)<\/name>/i);
  return m ? m[1].trim() : "";
}

/**
 * Parse a Katalon Object Repository `.rs` file (XML WebElementEntity).
 * Fault-tolerant: returns null on failure.
 */
export function parseObjectRepositoryRs(
  relPath: string,
  content: string
): ParsedTestObject | null {
  try {
    const xml = content.trim().replace(/^\uFEFF/, "");
    if (!xml.startsWith("<")) return null;

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
    });
    const parsed = parser.parse(xml);
    const entries = collectSelectorEntries(parsed);
    if (entries.length === 0) {
      const basic = xml.match(/<value>([^<]+)<\/value>/i);
      if (basic) entries.push({ key: "BASIC", value: basic[1].trim() });
    }
    if (entries.length === 0) return null;

    const primary = entries[0];
    const selectorType = inferSelectorType(primary.value, primary.key);
    const name = entityName(parsed, xml);
    const pathFromFile = relPath.replace(/\.rs$/i, "").split(/Object Repository\//i).pop();
    const orPath = pathFromFile?.replace(/^\/+/, "").replace(/\\/g, "/") ?? name;

    return {
      label: name || orPath.split("/").pop() || orPath,
      path: orPath,
      selectorType,
      selector: primary.value,
      alternativeSelectors: entries.slice(1).map((e) => ({
        type: inferSelectorType(e.value, e.key),
        value: e.value,
      })),
      sourceFile: relPath,
    };
  } catch {
    return null;
  }
}
