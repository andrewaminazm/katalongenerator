import type { ApiEndpointSpec } from "../apiCodeGenerator/types.js";
import type { ApiLoadCategory, ClassifiedEndpoint } from "./types.js";
import type { EnrichedApiEndpoint } from "../apiArchitect/types.js";

export function classifyLoadCategory(ep: ApiEndpointSpec): ApiLoadCategory {
  const hay = `${ep.method} ${ep.path} ${ep.name} ${ep.summary ?? ""}`.toLowerCase();
  if (/login|auth|token|oauth|session|refresh/i.test(hay)) return "auth";
  if (/payment|checkout|billing|charge|invoice/i.test(hay)) return "payment";
  if (/search|query|filter|list|find/i.test(hay) || (ep.method === "GET" && !/\{/.test(ep.path)))
    return "search";
  if (ep.method === "GET" || ep.method === "HEAD") return "read";
  if (ep.method === "POST" || ep.method === "PUT" || ep.method === "PATCH" || ep.method === "DELETE")
    return "write";
  return "default";
}

export function classifyEndpoints(endpoints: EnrichedApiEndpoint[]): ClassifiedEndpoint[] {
  return endpoints.map((ep) => {
    const loadCategory = classifyLoadCategory(ep);
    const critical = loadCategory === "auth" || loadCategory === "payment";
    const suggestedVus =
      loadCategory === "auth"
        ? 2
        : loadCategory === "payment"
          ? 3
          : loadCategory === "write"
            ? 5
            : loadCategory === "search"
              ? 15
              : loadCategory === "read"
                ? 20
                : 8;
    const maxRpsHint =
      loadCategory === "payment"
        ? 10
        : loadCategory === "write"
          ? 30
          : loadCategory === "auth"
            ? 5
            : 100;
    return { ...ep, loadCategory, suggestedVus, maxRpsHint, critical };
  });
}
