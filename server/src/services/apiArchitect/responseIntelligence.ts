import type { ApiEndpointSpec } from "../apiCodeGenerator/types.js";

export function flattenResponseFields(
  obj: Record<string, unknown> | undefined,
  prefix = "",
  depth = 0,
  maxDepth = 3
): { paths: string[]; types: Record<string, string> } {
  const paths: string[] = [];
  const types: Record<string, string> = {};
  if (!obj || depth > maxDepth) return { paths, types };

  for (const [key, val] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (val === null) {
      paths.push(path);
      types[path] = "null";
    } else if (Array.isArray(val)) {
      paths.push(path);
      types[path] = "array";
    } else if (typeof val === "object") {
      paths.push(path);
      types[path] = "object";
      const nested = flattenResponseFields(val as Record<string, unknown>, path, depth + 1, maxDepth);
      paths.push(...nested.paths);
      Object.assign(types, nested.types);
    } else {
      paths.push(path);
      types[path] = typeof val;
    }
  }
  return { paths, types };
}

export function inferFieldTypesFromExample(example?: Record<string, unknown>): Record<string, string> {
  const { types } = flattenResponseFields(example);
  const flat: Record<string, string> = {};
  for (const [k, t] of Object.entries(types)) {
    const top = k.split(".")[0];
    if (!flat[top]) flat[top] = t;
  }
  return flat;
}

export function enrichResponseMetadata(ep: ApiEndpointSpec): {
  responseFields: string[];
  fieldTypes: Record<string, string>;
  nestedResponseFields: string[];
} {
  const example = ep.responseExample;
  const { paths, types } = flattenResponseFields(example);
  const topLevel = example ? Object.keys(example) : ep.responseFields ?? [];
  const fieldTypes = { ...inferFieldTypesFromExample(example), ...ep.fieldTypes };

  return {
    responseFields: topLevel.length ? topLevel : paths.map((p) => p.split(".")[0]).filter((v, i, a) => a.indexOf(v) === i),
    fieldTypes,
    nestedResponseFields: paths,
  };
}

export function findIdFields(ep: ApiEndpointSpec): string[] {
  const candidates: string[] = [];
  const scan = (obj: Record<string, unknown> | undefined, prefix = ""): void => {
    if (!obj) return;
    for (const [k, v] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (/^(id|_id|uuid|userId|orderId|customerId|.*Id)$/i.test(k) && (typeof v === "string" || typeof v === "number")) {
        candidates.push(path);
      }
      if (v && typeof v === "object" && !Array.isArray(v)) {
        scan(v as Record<string, unknown>, path);
      }
    }
  };
  scan(ep.responseExample);
  if (!candidates.length && ep.responseFields?.includes("id")) candidates.push("id");
  return candidates;
}
