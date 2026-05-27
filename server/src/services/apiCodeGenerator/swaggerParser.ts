import { parse as parseYaml } from "yaml";
import type { ApiEndpointSpec, AuthType, HttpMethod } from "./types.js";

const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);

function slugName(path: string, method: string): string {
  const leaf = path.replace(/\{[^}]+\}/g, "id").replace(/^\//, "").replace(/\//g, "_");
  const base = leaf || "root";
  return `${method}_${base}`.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_");
}

function detectAuthFromSpec(spec: Record<string, unknown>): AuthType {
  const components = spec.components as Record<string, unknown> | undefined;
  const schemes = components?.securitySchemes as Record<string, Record<string, unknown>> | undefined;
  if (!schemes) return "none";
  for (const s of Object.values(schemes)) {
    const t = String(s.type ?? "").toLowerCase();
    const scheme = String(s.scheme ?? "").toLowerCase();
    if (t === "http" && scheme === "bearer") return "bearer";
    if (t === "http" && scheme === "basic") return "basic";
    if (t === "apikey") return "apiKey";
    if (t === "oauth2") return "oauth2";
    if (scheme === "bearer" || String(s.bearerFormat ?? "").toLowerCase() === "jwt") return "jwt";
  }
  return "none";
}

function exampleFromSchema(schema: unknown): Record<string, unknown> | undefined {
  if (!schema || typeof schema !== "object") return undefined;
  const s = schema as Record<string, unknown>;
  if (s.example && typeof s.example === "object") return s.example as Record<string, unknown>;
  const props = s.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(props)) {
    const t = String(v.type ?? "string");
    if (t === "integer" || t === "number") out[k] = 0;
    else if (t === "boolean") out[k] = false;
    else if (t === "array") out[k] = [];
    else out[k] = `sample_${k}`;
  }
  return out;
}

function fieldsFromSchema(schema: unknown): { fields: string[]; required: string[]; types: Record<string, string> } {
  if (!schema || typeof schema !== "object") return { fields: [], required: [], types: {} };
  const s = schema as Record<string, unknown>;
  const props = s.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return { fields: [], required: [], types: {} };
  const types: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    types[k] = String(v.type ?? "string");
  }
  return {
    fields: Object.keys(props),
    required: Array.isArray(s.required) ? (s.required as string[]) : [],
    types,
  };
}

export function parseOpenApiDocument(raw: string): { endpoints: ApiEndpointSpec[]; auth: AuthType; warnings: string[] } {
  const warnings: string[] = [];
  let spec: Record<string, unknown>;
  const trimmed = raw.trim();
  try {
    spec = trimmed.startsWith("{") ? (JSON.parse(trimmed) as Record<string, unknown>) : (parseYaml(trimmed) as Record<string, unknown>);
  } catch (e) {
    throw new Error(`Invalid OpenAPI document: ${e instanceof Error ? e.message : String(e)}`);
  }

  const globalAuth = detectAuthFromSpec(spec);
  const paths = spec.paths as Record<string, Record<string, unknown>> | undefined;
  if (!paths) {
    throw new Error("OpenAPI document has no paths section");
  }

  const endpoints: ApiEndpointSpec[] = [];
  const isOas3 = Boolean(spec.openapi);

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== "object") continue;
    for (const [method, op] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) continue;
      const operation = op as Record<string, unknown>;
      const m = method.toUpperCase() as HttpMethod;
      const name = String(operation.operationId ?? slugName(path, method));
      let requestBodyExample: Record<string, unknown> | undefined;
      let responseExample: Record<string, unknown> | undefined;
      let responseFields: string[] = [];
      let requiredFields: string[] = [];
      let fieldTypes: Record<string, string> = {};

      if (isOas3) {
        const rb = operation.requestBody as Record<string, unknown> | undefined;
        const content = rb?.content as Record<string, Record<string, unknown>> | undefined;
        const json = content?.["application/json"];
        requestBodyExample = exampleFromSchema(json?.schema);
        const responses = operation.responses as Record<string, Record<string, unknown>> | undefined;
        const ok = responses?.["200"] ?? responses?.["201"] ?? responses?.["default"];
        const okContent = ok?.content as Record<string, Record<string, unknown>> | undefined;
        const okJson = okContent?.["application/json"];
        const parsed = fieldsFromSchema(okJson?.schema);
        responseFields = parsed.fields;
        requiredFields = parsed.required;
        fieldTypes = parsed.types;
        responseExample = exampleFromSchema(okJson?.schema);
      } else {
        const params = (operation.parameters ?? pathItem.parameters) as unknown[] | undefined;
        if (Array.isArray(params)) {
          const bodyParam = params.find(
            (p) => p && typeof p === "object" && (p as Record<string, unknown>).in === "body"
          ) as Record<string, unknown> | undefined;
          if (bodyParam?.schema) {
            requestBodyExample = exampleFromSchema(bodyParam.schema);
            const parsed = fieldsFromSchema(bodyParam.schema);
            requiredFields = parsed.required;
            fieldTypes = parsed.types;
          }
        }
        const responses = operation.responses as Record<string, Record<string, unknown>> | undefined;
        const ok = responses?.["200"] ?? responses?.["201"];
        const okSchema = ok?.schema;
        const parsed = fieldsFromSchema(okSchema);
        responseFields = parsed.fields;
        requiredFields = parsed.required.length ? parsed.required : requiredFields;
        fieldTypes = { ...fieldTypes, ...parsed.types };
        responseExample = exampleFromSchema(okSchema);
      }

      const opAuth = operation.security === null ? "none" : globalAuth;
      const tags = Array.isArray(operation.tags)
        ? (operation.tags as string[]).filter((t) => typeof t === "string")
        : [];

      endpoints.push({
        id: `${m}:${path}`,
        name,
        method: m,
        path,
        summary: typeof operation.summary === "string" ? operation.summary : undefined,
        requestBodyExample,
        responseExample,
        responseFields,
        requiredFields,
        fieldTypes,
        auth: opAuth,
        openApiTags: tags.length ? tags : undefined,
      });
    }
  }

  if (!endpoints.length) warnings.push("No HTTP operations found in OpenAPI paths.");
  return { endpoints, auth: globalAuth, warnings };
}
