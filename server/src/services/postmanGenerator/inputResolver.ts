import {
  analyzeEndpointInput,
  parseCurlCommand,
  parseOpenApiDocument,
  parsePostmanCollection,
  type ApiEndpointSpec,
} from "../apiCodeGenerator/index.js";
import { groupBySemanticModule } from "../apiArchitect/semanticClassifier.js";
import type { PostmanGenerateRequest, ResolvedPostmanInput } from "./types.js";
import type { AuthType } from "../apiCodeGenerator/types.js";

function detectAuth(endpoints: ApiEndpointSpec[]): AuthType {
  return endpoints.find((e) => e.auth && e.auth !== "none")?.auth ?? "none";
}

function inferBaseUrl(req: PostmanGenerateRequest, endpoints: ApiEndpointSpec[]): string {
  if (req.baseUrl?.trim()) return req.baseUrl.trim().replace(/\/$/, "");
  for (const ep of endpoints) {
    if (ep.path.startsWith("http")) {
      try {
        const u = new URL(ep.path);
        return u.origin;
      } catch {
        /* continue */
      }
    }
  }
  return "{{baseUrl}}";
}

export function resolvePostmanInput(req: PostmanGenerateRequest): ResolvedPostmanInput {
  const warnings: string[] = [];
  let endpoints: ApiEndpointSpec[] = [];

  if (Array.isArray(req.endpoints) && req.endpoints.length) {
    endpoints = req.endpoints;
  } else {
    const inputType = req.inputType ?? inferInputType(req);
    if (inputType === "swagger") {
      const spec = req.swagger ?? req.spec ?? "";
      if (!spec.trim()) throw new Error("Provide Swagger or OpenAPI JSON or YAML");
      const parsed = parseOpenApiDocument(spec);
      endpoints = parsed.endpoints;
      warnings.push(...parsed.warnings);
    } else if (inputType === "postman") {
      const col = req.collection ?? "";
      if (!col.trim()) throw new Error("Provide Postman collection JSON to convert/enhance");
      const parsed = parsePostmanCollection(col);
      endpoints = parsed.endpoints;
      warnings.push(...parsed.warnings);
    } else if (inputType === "curl") {
      const curl = req.curl ?? "";
      if (!curl.trim()) throw new Error("Provide cURL command");
      endpoints = [parseCurlCommand(curl)];
    } else {
      if (!req.path?.trim() && !req.url?.trim()) {
        throw new Error("Provide endpoint path or URL");
      }
      endpoints = [
        analyzeEndpointInput({
          method: req.method,
          path: req.path,
          url: req.url,
          requestJson: req.requestJson,
          responseJson: req.responseJson,
          name: req.testCaseName,
        }),
      ];
    }
  }

  if (!endpoints.length) throw new Error("No API endpoints to generate Postman collection");

  const collectionName =
    req.testCaseName?.trim() ||
    (endpoints.length === 1 ? endpoints[0].name : "AI Generated API Collection");

  return {
    endpoints,
    warnings,
    collectionName,
    baseUrl: inferBaseUrl(req, endpoints),
    primaryAuth: detectAuth(endpoints),
  };
}

function inferInputType(req: PostmanGenerateRequest): PostmanGenerateRequest["inputType"] {
  if (req.swagger?.trim() || req.spec?.trim()) return "swagger";
  if (req.curl?.trim()) return "curl";
  if (req.collection?.trim()) return "postman";
  return "endpoint";
}

export function groupEndpointsByFolder(endpoints: ApiEndpointSpec[]): Map<string, ApiEndpointSpec[]> {
  return groupBySemanticModule(endpoints);
}
