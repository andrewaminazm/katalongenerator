import type { ClassifiedEndpoint } from "./types.js";

export interface CorrelationExtractor {
  name: string;
  jsonPath: string;
  targetVar: string;
  scope: "global" | "local";
}

export function buildCorrelationExtractors(endpoints: ClassifiedEndpoint[]): CorrelationExtractor[] {
  const extractors: CorrelationExtractor[] = [];
  const seen = new Set<string>();

  for (const ep of endpoints) {
    for (const v of ep.producesVars ?? []) {
      if (seen.has(v.envKey)) continue;
      seen.add(v.envKey);
      extractors.push({
        name: `extract_${v.envKey}`,
        jsonPath: `$.${v.jsonPath}`,
        targetVar: v.envKey,
        scope: /token|auth/i.test(v.envKey) ? "global" : "local",
      });
    }
    if (/login|auth|token/i.test(ep.path) && !seen.has("authToken")) {
      seen.add("authToken");
      extractors.push({
        name: "extract_authToken",
        jsonPath: "$.token",
        targetVar: "authToken",
        scope: "global",
      });
      extractors.push({
        name: "extract_access_token",
        jsonPath: "$.access_token",
        targetVar: "token",
        scope: "global",
      });
    }
  }

  return extractors;
}

export function authEndpointFirst(endpoints: ClassifiedEndpoint[]): ClassifiedEndpoint[] {
  const auth = endpoints.filter((e) => e.loadCategory === "auth");
  const rest = endpoints.filter((e) => e.loadCategory !== "auth");
  return [...auth, ...rest];
}
