import type { ApiEndpointSpec, AuthType, HttpMethod } from "./types.js";

function slugFromName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "") || "Request";
}

function detectAuthFromRequest(req: Record<string, unknown>): AuthType {
  const auth = req.auth as Record<string, unknown> | undefined;
  if (!auth) return "none";
  const type = String(auth.type ?? "").toLowerCase();
  if (type === "bearer") return "bearer";
  if (type === "basic") return "basic";
  if (type === "apikey") return "apiKey";
  if (type === "oauth2") return "oauth2";
  return "none";
}

function parseUrl(raw: unknown): { path: string; host?: string } {
  if (typeof raw === "string") {
    try {
      const u = new URL(raw);
      return { path: u.pathname + u.search, host: u.origin };
    } catch {
      return { path: raw.startsWith("/") ? raw : `/${raw}` };
    }
  }
  if (raw && typeof raw === "object") {
    const u = raw as Record<string, unknown>;
    const pathParts = Array.isArray(u.path) ? (u.path as string[]).join("/") : "";
    const query = Array.isArray(u.query)
      ? (u.query as { key: string; value?: string }[])
          .filter((q) => q.key)
          .map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value ?? "")}`)
          .join("&")
      : "";
    const path = `/${pathParts.replace(/^\/+/, "")}${query ? `?${query}` : ""}`;
    const host = Array.isArray(u.host) ? (u.host as string[]).join(".") : undefined;
    const protocol = Array.isArray(u.protocol) ? (u.protocol as string[])[0] : "https";
    return {
      path,
      host: host ? `${protocol}://${host}` : undefined,
    };
  }
  return { path: "/" };
}

function bodyToExample(body: unknown): Record<string, unknown> | undefined {
  if (!body || typeof body !== "object") return undefined;
  const b = body as Record<string, unknown>;
  const mode = String(b.mode ?? "");
  if (mode === "raw" && typeof b.raw === "string") {
    try {
      return JSON.parse(b.raw) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  if (mode === "urlencoded" && Array.isArray(b.urlencoded)) {
    const out: Record<string, unknown> = {};
    for (const p of b.urlencoded as { key: string; value?: string }[]) {
      if (p.key) out[p.key] = p.value ?? "";
    }
    return out;
  }
  return undefined;
}

function walkItems(
  items: unknown[],
  endpoints: ApiEndpointSpec[],
  warnings: string[],
  prefix = ""
): void {
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    if (Array.isArray(it.item)) {
      const folder = String(it.name ?? "Folder");
      walkItems(it.item, endpoints, warnings, prefix ? `${prefix}/${folder}` : folder);
      continue;
    }
    const req = it.request as Record<string, unknown> | undefined;
    if (!req) continue;
    const method = String(req.method ?? "GET").toUpperCase() as HttpMethod;
    const { path } = parseUrl(req.url);
    const name = slugFromName(String(it.name ?? `${method}_${path}`));
    const requestBodyExample = bodyToExample(req.body);
    const responseFields: string[] = [];
    const responses = it.response as unknown[] | undefined;
    let responseExample: Record<string, unknown> | undefined;
    if (Array.isArray(responses) && responses[0] && typeof responses[0] === "object") {
      const r0 = responses[0] as Record<string, unknown>;
      if (typeof r0.body === "string") {
        try {
          responseExample = JSON.parse(r0.body) as Record<string, unknown>;
          responseFields.push(...Object.keys(responseExample));
        } catch {
          warnings.push(`Could not parse saved response body for ${name}`);
        }
      }
    }

    endpoints.push({
      id: `${method}:${path}:${name}`,
      name,
      method,
      path,
      summary: prefix ? `${prefix} — ${String(it.name ?? name)}` : String(it.name ?? name),
      requestBodyExample,
      responseExample,
      responseFields,
      auth: detectAuthFromRequest(req),
    });
  }
}

export function parsePostmanCollection(raw: string): { endpoints: ApiEndpointSpec[]; auth: AuthType; warnings: string[] } {
  const warnings: string[] = [];
  let collection: Record<string, unknown>;
  try {
    collection = JSON.parse(raw.trim()) as Record<string, unknown>;
  } catch (e) {
    throw new Error(`Invalid Postman collection JSON: ${e instanceof Error ? e.message : String(e)}`);
  }

  const info = collection.info as Record<string, unknown> | undefined;
  if (!info?.schema && !collection.item) {
    throw new Error("Not a Postman Collection v2.x document");
  }

  const endpoints: ApiEndpointSpec[] = [];
  const items = collection.item;
  if (!Array.isArray(items)) {
    throw new Error("Postman collection has no item array");
  }
  walkItems(items, endpoints, warnings);

  const auth =
    endpoints.find((e) => e.auth && e.auth !== "none")?.auth ?? "none";
  if (!endpoints.length) warnings.push("No requests found in Postman collection.");
  return { endpoints, auth, warnings };
}
