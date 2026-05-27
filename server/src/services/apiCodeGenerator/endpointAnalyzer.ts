import type { ApiEndpointSpec, HttpMethod } from "./types.js";

export interface EndpointInputPayload {
  method?: string;
  path?: string;
  url?: string;
  requestJson?: string;
  responseJson?: string;
  headers?: Record<string, string>;
  name?: string;
}

function parseJsonSafe(raw: string | undefined): Record<string, unknown> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    return JSON.parse(raw.trim()) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function inferAuth(headers?: Record<string, string>): ApiEndpointSpec["auth"] {
  if (!headers) return "none";
  const auth = headers.authorization ?? headers.Authorization ?? "";
  if (/^bearer\s+/i.test(auth)) return "bearer";
  if (/^basic\s+/i.test(auth)) return "basic";
  if (headers["x-api-key"] || headers["api-key"]) return "apiKey";
  return "none";
}

export function analyzeEndpointInput(input: EndpointInputPayload): ApiEndpointSpec {
  let method = (input.method?.trim().toUpperCase() || "POST") as HttpMethod;
  let path = input.path?.trim() || "";
  const url = input.url?.trim();

  if (url) {
    try {
      const u = new URL(url);
      path = u.pathname + u.search;
      if (!input.method) method = "GET";
    } catch {
      path = url.startsWith("/") ? url : `/${url}`;
    }
  }

  if (!path) throw new Error("Provide endpoint path or full URL");

  const requestBodyExample = parseJsonSafe(input.requestJson);
  const responseExample = parseJsonSafe(input.responseJson);
  const responseFields = responseExample ? Object.keys(responseExample) : [];
  const name =
    input.name?.trim() ||
    path
      .split("/")
      .filter(Boolean)
      .pop()
      ?.replace(/[^a-zA-Z0-9]/g, "_") ||
    "ApiEndpoint";

  if (requestBodyExample && method === "GET") method = "POST";

  return {
    id: `${method}:${path}`,
    name,
    method,
    path,
    requestBodyExample,
    responseExample,
    responseFields,
    requiredFields: requestBodyExample ? Object.keys(requestBodyExample) : [],
    headers: input.headers,
    auth: inferAuth(input.headers),
  };
}

/** GraphQL: treat as POST with query body */
export function analyzeGraphqlInput(query: string, operationName?: string): ApiEndpointSpec {
  const name = operationName?.trim() || "GraphQL_Query";
  return {
    id: `POST:/graphql:${name}`,
    name: name.replace(/[^a-zA-Z0-9_]/g, "_"),
    method: "POST",
    path: "/graphql",
    requestBodyExample: { query: query.trim(), variables: {} },
    responseFields: ["data"],
    auth: "bearer",
  };
}
