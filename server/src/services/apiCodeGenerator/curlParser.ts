import type { ApiEndpointSpec, HttpMethod } from "./types.js";

export function parseCurlCommand(raw: string): ApiEndpointSpec {
  const line = raw.replace(/\\\r?\n/g, " ").replace(/\s+/g, " ").trim();
  if (!/^curl\b/i.test(line)) {
    throw new Error("Input must start with curl");
  }

  let method: HttpMethod = "GET";
  let url = "";
  const headers: Record<string, string> = {};
  let bodyJson: Record<string, unknown> | undefined;

  const methodMatch = line.match(/-X\s+([A-Z]+)/i);
  if (methodMatch) method = methodMatch[1].toUpperCase() as HttpMethod;

  const urlMatch =
    line.match(/curl\s+(?:-[^\s]+\s+)*['"]?(https?:\/\/[^\s'"]+)['"]?/i) ??
    line.match(/['"]?(https?:\/\/[^\s'"]+)['"]?/i);
  if (urlMatch) url = urlMatch[1];

  const headerRegex = /-H\s+['"]([^:'"]+):\s*([^'"]+)['"]/gi;
  let hm: RegExpExecArray | null;
  while ((hm = headerRegex.exec(line)) !== null) {
    headers[hm[1].toLowerCase()] = hm[2];
  }

  const dataMatch =
    line.match(/(?:--data-raw|--data|-d)\s+['"](.+?)['"]\s*(?:-|$)/i) ??
    line.match(/(?:--data-raw|--data|-d)\s+(\{.+?\})(?:\s|$)/i);
  if (dataMatch) {
    try {
      bodyJson = JSON.parse(dataMatch[1]) as Record<string, unknown>;
      if (method === "GET") method = "POST";
    } catch {
      /* non-json body */
    }
  }

  if (!url) throw new Error("Could not extract URL from cURL command");

  let path = "/";
  try {
    const u = new URL(url);
    path = u.pathname + u.search;
  } catch {
    path = url;
  }

  const name = path.split("/").filter(Boolean).pop() ?? "CurlRequest";
  let auth: ApiEndpointSpec["auth"] = "none";
  const authHeader = headers.authorization ?? headers.Authorization;
  if (authHeader?.toLowerCase().startsWith("bearer")) auth = "bearer";
  else if (authHeader?.toLowerCase().startsWith("basic")) auth = "basic";

  return {
    id: `${method}:${path}`,
    name: name.replace(/[^a-zA-Z0-9]/g, "_"),
    method,
    path,
    headers,
    requestBodyExample: bodyJson,
    responseFields: bodyJson ? [] : undefined,
    auth,
  };
}
