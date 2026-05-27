import type { ApiEndpointSpec } from "../apiCodeGenerator/types.js";

/** Business modules — ordered by match priority (first match wins) */
const MODULE_RULES: { module: string; patterns: RegExp[] }[] = [
  { module: "Authentication", patterns: [/\/(auth|login|token|oauth|session)\b/i, /\b(login|signin|authenticate|refresh.?token)\b/i] },
  { module: "Users", patterns: [/\/users?\b/i, /\b(user|profile|account|member)\b/i] },
  { module: "Orders", patterns: [/\/orders?\b/i, /\b(order|checkout|cart)\b/i] },
  { module: "Products", patterns: [/\/products?\b/i, /\b(product|catalog|sku|item)\b/i] },
  { module: "Inventory", patterns: [/\/inventory\b/i, /\b(stock|warehouse)\b/i] },
  { module: "Payments", patterns: [/\/payments?\b/i, /\b(payment|billing|invoice|charge)\b/i] },
  { module: "Admin", patterns: [/\/admin\b/i, /\b(admin|role|permission)\b/i] },
  { module: "Reports", patterns: [/\/reports?\b/i, /\b(report|analytics|dashboard|metrics)\b/i] },
];

const SEGMENT_ALIASES: Record<string, string> = {
  auth: "Authentication",
  login: "Authentication",
  token: "Authentication",
  user: "Users",
  users: "Users",
  order: "Orders",
  orders: "Orders",
  product: "Products",
  products: "Products",
  inventory: "Inventory",
  payment: "Payments",
  payments: "Payments",
  admin: "Admin",
  report: "Reports",
  reports: "Reports",
};

export function classifySemanticModule(ep: ApiEndpointSpec): string {
  if (ep.openApiTags?.length) {
    const tag = ep.openApiTags[0];
    for (const rule of MODULE_RULES) {
      if (rule.patterns.some((p) => p.test(tag))) return rule.module;
    }
    const cleaned = tag.replace(/[^a-zA-Z0-9]/g, " ").trim();
    if (cleaned) return cleaned.split(/\s+/).map(capitalize).join(" ");
  }

  const hay = `${ep.method} ${ep.path} ${ep.name} ${ep.summary ?? ""}`;
  for (const rule of MODULE_RULES) {
    if (rule.patterns.some((p) => p.test(hay))) return rule.module;
  }

  const segments = ep.path.replace(/^\//, "").split("/").filter(Boolean);
  const first = segments[0]?.replace(/\{|\}/g, "").toLowerCase() ?? "";
  if (SEGMENT_ALIASES[first]) return SEGMENT_ALIASES[first];

  if (first && !/^(v\d+|api)$/i.test(first)) {
    return first.charAt(0).toUpperCase() + first.slice(1).replace(/[^a-zA-Z0-9]/g, "");
  }

  return "API";
}

export function businessActionLabel(ep: ApiEndpointSpec): string {
  const method = ep.method.charAt(0) + ep.method.slice(1).toLowerCase();
  const parts = ep.path.split("/").filter(Boolean);
  const last = parts[parts.length - 1]?.replace(/\{|\}/g, "") ?? ep.name;
  const resource = parts.find((p) => !/^\{/.test(p) && !/^v\d+$/i.test(p))?.replace(/\{|\}/g, "") ?? last;

  if (/login|auth|token/i.test(ep.path)) return `${method} — Authenticate`;
  if (ep.method === "POST" && !/\{/.test(ep.path)) return `Create ${capitalize(singularize(resource))}`;
  if (ep.method === "GET" && /\{/.test(ep.path)) return `Get ${capitalize(singularize(resource))} by ID`;
  if (ep.method === "GET") return `List ${capitalize(pluralize(resource))}`;
  if (ep.method === "PUT" || ep.method === "PATCH") return `Update ${capitalize(singularize(resource))}`;
  if (ep.method === "DELETE") return `Delete ${capitalize(singularize(resource))}`;

  return `${method} ${last || ep.name}`;
}

function capitalize(s: string): string {
  if (!s) return "Resource";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function singularize(s: string): string {
  if (s.endsWith("ies")) return s.slice(0, -3) + "y";
  if (s.endsWith("s") && s.length > 3) return s.slice(0, -1);
  return s;
}

function pluralize(s: string): string {
  if (s.endsWith("y")) return s.slice(0, -1) + "ies";
  if (!s.endsWith("s")) return s + "s";
  return s;
}

export function groupBySemanticModule(endpoints: ApiEndpointSpec[]): Map<string, ApiEndpointSpec[]> {
  const map = new Map<string, ApiEndpointSpec[]>();
  for (const ep of endpoints) {
    const mod = (ep as { semanticModule?: string }).semanticModule ?? classifySemanticModule(ep);
    const list = map.get(mod) ?? [];
    list.push(ep);
    map.set(mod, list);
  }
  return map;
}
