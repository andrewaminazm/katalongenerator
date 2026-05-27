import type { ApiEndpointSpec } from "../apiCodeGenerator/types.js";

/** Order endpoints for chained flows: auth first, then creates, then reads */
export function orderEndpointsForFlow(endpoints: ApiEndpointSpec[]): ApiEndpointSpec[] {
  const score = (ep: ApiEndpointSpec): number => {
    const p = `${ep.method} ${ep.path} ${ep.name}`.toLowerCase();
    if (/login|auth|token/.test(p)) return 0;
    if (ep.method === "POST") return 1;
    if (ep.method === "GET") return 2;
    if (ep.method === "PUT" || ep.method === "PATCH") return 3;
    if (ep.method === "DELETE") return 4;
    return 5;
  };
  return [...endpoints].sort((a, b) => score(a) - score(b));
}

export function flowWarnings(endpoints: ApiEndpointSpec[]): string[] {
  const warnings: string[] = [];
  const hasLogin = endpoints.some((e) => /login|auth|token/i.test(e.path + e.name));
  if (endpoints.length > 1 && !hasLogin) {
    warnings.push(
      "No login/auth endpoint detected — add a token extraction request or set {{token}} in environment manually."
    );
  }
  if (endpoints.length > 1) {
    warnings.push("Requests ordered for flow: Authentication → POST → GET → PUT/PATCH → DELETE.");
  }
  return warnings;
}
