import type { ApiEndpointSpec } from "../apiCodeGenerator/types.js";
import { findIdFields } from "./responseIntelligence.js";
import type { ProducedVariable } from "./types.js";

export function extractPathParams(path: string): string[] {
  const params: string[] = [];
  const re = /\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) {
    params.push(m[1]);
  }
  return params;
}

export function envKeyFromParam(param: string): string {
  if (/^id$/i.test(param)) return "resourceId";
  return param.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_+/, "");
}

export function pathToTemplate(path: string, varMap: Record<string, string>): string {
  let out = path;
  for (const [param, envKey] of Object.entries(varMap)) {
    out = out.replace(new RegExp(`\\{${param}\\}`, "g"), `{{${envKey}}}`);
  }
  return out;
}

export function inferProducesVars(ep: ApiEndpointSpec): ProducedVariable[] {
  const vars: ProducedVariable[] = [];
  const idFields = findIdFields(ep);

  for (const jsonPath of idFields) {
    const leaf = jsonPath.split(".").pop() ?? jsonPath;
    vars.push({
      envKey: envKeyFromParam(leaf),
      jsonPath,
      confidence: ep.method === "POST" ? 0.94 : 0.82,
    });
  }

  const tokenField =
    ep.responseFields?.find((f) => /token|access_token/i.test(f)) ??
    (ep.responseExample && ("token" in ep.responseExample || "access_token" in ep.responseExample)
      ? "token" in ep.responseExample
        ? "token"
        : "access_token"
      : null);

  if (tokenField) {
    vars.push({ envKey: "authToken", jsonPath: tokenField, confidence: 0.96 });
    vars.push({ envKey: "token", jsonPath: tokenField, confidence: 0.96 });
  }

  return vars;
}

export function inferConsumesVars(ep: ApiEndpointSpec, catalog: ProducedVariable[]): string[] {
  const params = extractPathParams(ep.path);
  const consumed: string[] = [];

  for (const param of params) {
    const key = envKeyFromParam(param);
    const match = catalog.find((v) => v.envKey === key || v.jsonPath === param || v.envKey === param);
    if (match) consumed.push(match.envKey);
    else consumed.push(key);
  }
  return consumed;
}

export function buildResourceCatalog(endpoints: ApiEndpointSpec[]): ProducedVariable[] {
  const catalog: ProducedVariable[] = [];
  for (const ep of endpoints) {
    if (ep.method === "POST" || /login|auth/i.test(ep.path)) {
      for (const v of inferProducesVars(ep)) {
        if (!catalog.some((c) => c.envKey === v.envKey)) catalog.push(v);
      }
    }
  }
  return catalog;
}
