import { XMLParser } from "fast-xml-parser";

export interface MobileUiNode {
  platform: "android" | "ios" | "unknown";
  className?: string;
  type?: string;
  text?: string;
  resourceId?: string;
  contentDesc?: string;
  name?: string;
  label?: string;
  value?: string;
  bounds?: string;
  /** Minimal xpath-ish path for last-resort fallback */
  path?: string;
}

function asString(v: unknown): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t : undefined;
}

function detectPlatform(xml: string): "android" | "ios" | "unknown" {
  const h = xml.slice(0, 4000).toLowerCase();
  if (h.includes("hierarchy") || h.includes("resource-id") || h.includes("content-desc")) return "android";
  if (h.includes("xcui") || h.includes("xctest") || h.includes("type=")) return "ios";
  return "unknown";
}

function collectNodes(
  obj: any,
  platform: "android" | "ios" | "unknown",
  pathSegs: string[],
  out: MobileUiNode[]
) {
  if (!obj || typeof obj !== "object") return;

  const keys = Object.keys(obj);
  for (const k of keys) {
    const val = (obj as any)[k];

    // fast-xml-parser represents attributes as "@_attr"
    if (val && typeof val === "object") {
      const attrs: Record<string, unknown> = val;
      const node: MobileUiNode = { platform };
      node.path = [...pathSegs, k].join("/");

      // Android
      node.className = asString(attrs["@_class"] ?? attrs["class"]);
      node.text = asString(attrs["@_text"] ?? attrs["text"]);
      node.resourceId = asString(attrs["@_resource-id"] ?? attrs["resource-id"]);
      node.contentDesc = asString(attrs["@_content-desc"] ?? attrs["content-desc"]);
      node.bounds = asString(attrs["@_bounds"] ?? attrs["bounds"]);

      // iOS (Appium page source)
      node.type = asString(attrs["@_type"] ?? attrs["type"]) ?? node.className;
      node.name = asString(attrs["@_name"] ?? attrs["name"]);
      node.label = asString(attrs["@_label"] ?? attrs["label"]);
      node.value = asString(attrs["@_value"] ?? attrs["value"]);

      const hasAny =
        node.resourceId ||
        node.contentDesc ||
        node.text ||
        node.name ||
        node.label ||
        node.value ||
        node.className ||
        node.type;

      if (hasAny) out.push(node);

      // recurse into children
      collectNodes(val, platform, [...pathSegs, k], out);
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        collectNodes(val[i], platform, [...pathSegs, `${k}[${i}]`], out);
      }
    }
  }
}

export function parseMobilePageSource(xml: string): { platform: "android" | "ios" | "unknown"; nodes: MobileUiNode[] } {
  const platform = detectPlatform(xml);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    trimValues: true,
  });

  const parsed = parser.parse(xml);
  const nodes: MobileUiNode[] = [];
  collectNodes(parsed, platform, [], nodes);
  return { platform, nodes };
}

