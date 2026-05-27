import {
  analyzeEndpointInput,
  parseCurlCommand,
  parseOpenApiDocument,
  parsePostmanCollection,
} from "../apiCodeGenerator/index.js";
import { enrichEndpointsInPlace } from "../apiArchitect/index.js";
import { loadProjectIndex } from "../projectIntelligence/projectStore.js";
import type { ApiEndpointSpec } from "../apiCodeGenerator/types.js";
import type { PerformanceGenerateRequest } from "./types.js";

function inferBaseUrl(req: PerformanceGenerateRequest, endpoints: ApiEndpointSpec[]): string {
  if (req.config?.baseUrl?.trim()) return req.config.baseUrl.trim().replace(/\/$/, "");
  const env = req.config?.environment;
  if (env === "qa") return "https://api-qa.example.com";
  if (env === "staging") return "https://api-staging.example.com";
  if (env === "production") return "https://api.example.com";
  for (const ep of endpoints) {
    if (ep.path.startsWith("http")) {
      try {
        return new URL(ep.path).origin;
      } catch {
        /* continue */
      }
    }
  }
  return "https://api.example.com";
}

async function endpointsFromProject(projectId: string): Promise<{ endpoints: ApiEndpointSpec[]; warnings: string[] }> {
  const warnings: string[] = [];
  const index = await loadProjectIndex(projectId);
  if (!index) {
    warnings.push(`Project ${projectId} not indexed — upload or reindex to use project APIs.`);
    return { endpoints: [], warnings };
  }

  const apiObjects = index.testObjects.filter((t) => /\/API\//i.test(t.path) || /^API\//i.test(t.path));
  if (!apiObjects.length) {
    warnings.push("No Object Repository/API RequestObjects found in project — use Swagger or Postman input.");
    return { endpoints: [], warnings };
  }

  const endpoints: ApiEndpointSpec[] = apiObjects.slice(0, 40).map((obj, i) => {
    const leaf = obj.path.split("/").pop() ?? obj.label;
    const method = /get/i.test(leaf) ? "GET" : /delete/i.test(leaf) ? "DELETE" : /put|patch/i.test(leaf) ? "PUT" : "POST";
    const path = `/${leaf.replace(/_/g, "/").replace(/\\/g, "/")}`;
    return {
      id: `project:${obj.path}`,
      name: obj.label.replace(/[^a-zA-Z0-9_]/g, "_"),
      method: method as ApiEndpointSpec["method"],
      path,
      summary: `From project OR: ${obj.path}`,
    };
  });

  warnings.push(`Loaded ${endpoints.length} API RequestObject(s) from project ${index.projectName}.`);
  return { endpoints, warnings };
}

export async function resolvePerformanceInput(
  req: PerformanceGenerateRequest
): Promise<{ endpoints: ApiEndpointSpec[]; warnings: string[]; baseUrl: string; suiteName: string }> {
  const warnings: string[] = [];
  let endpoints: ApiEndpointSpec[] = [];

  const inputType = req.inputType ?? inferInputType(req);

  if (req.useProjectApis && req.projectId) {
    const fromProject = await endpointsFromProject(req.projectId);
    endpoints.push(...fromProject.endpoints);
    warnings.push(...fromProject.warnings);
  }

  if (inputType === "openapi") {
    const spec = req.swagger ?? req.spec ?? (req.input?.spec as string) ?? (req.input?.swagger as string) ?? "";
    if (!spec.trim() && !endpoints.length) throw new Error("Provide Swagger or OpenAPI JSON or YAML");
    if (spec.trim()) {
      const parsed = parseOpenApiDocument(spec);
      endpoints = [...endpoints, ...parsed.endpoints];
      warnings.push(...parsed.warnings);
    }
  } else if (inputType === "postman") {
    const col = req.collection ?? (req.input?.collection as string) ?? "";
    if (!col.trim() && !endpoints.length) throw new Error("Provide Postman collection JSON");
    if (col.trim()) {
      const parsed = parsePostmanCollection(col);
      endpoints = [...endpoints, ...parsed.endpoints];
      warnings.push(...parsed.warnings);
      warnings.push("Postman folder structure mapped to performance scenarios.");
    }
  } else if (inputType === "curl") {
    const curl = req.curl ?? (req.input?.curl as string) ?? "";
    if (!curl.trim() && !endpoints.length) throw new Error("Provide cURL command");
    if (curl.trim()) endpoints.push(parseCurlCommand(curl));
  } else {
    if (!req.path?.trim() && !req.url?.trim() && !endpoints.length) {
      throw new Error("Provide endpoint path, URL, or project/Swagger/Postman input");
    }
    if (req.path?.trim() || req.url?.trim()) {
      endpoints.push(
        analyzeEndpointInput({
          method: req.method,
          path: req.path,
          url: req.url,
          requestJson: req.requestJson,
          responseJson: req.responseJson,
          name: req.testCaseName,
        })
      );
    }
  }

  if (!endpoints.length) throw new Error("No API endpoints resolved for performance generation");

  enrichEndpointsInPlace(endpoints);

  const suiteName =
    req.testCaseName?.trim() ||
    (endpoints.length === 1 ? endpoints[0].name : "Performance Test Suite");

  return {
    endpoints,
    warnings,
    baseUrl: inferBaseUrl(req, endpoints),
    suiteName,
  };
}

function inferInputType(req: PerformanceGenerateRequest): PerformanceGenerateRequest["inputType"] {
  if (req.useProjectApis && req.projectId) return "project";
  if (req.swagger?.trim() || req.spec?.trim()) return "openapi";
  if (req.collection?.trim()) return "postman";
  if (req.curl?.trim()) return "curl";
  return "endpoint";
}
