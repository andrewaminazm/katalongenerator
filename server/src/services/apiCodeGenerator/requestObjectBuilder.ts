import type { ApiEndpointSpec } from "./types.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";

export function toRequestObjectPath(endpoint: ApiEndpointSpec): string {
  const segment = endpoint.name
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_");
  const pascal = segment
    .split("_")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join("");
  return `Object Repository/API/${pascal || "Request"}`;
}

export function matchProjectRequestObject(
  endpoint: ApiEndpointSpec,
  index: ProjectIndex | null
): string | null {
  if (!index?.testObjects?.length) return null;
  const pathLower = endpoint.path.toLowerCase();
  const nameLower = endpoint.name.toLowerCase();
  const method = endpoint.method.toLowerCase();

  for (const to of index.testObjects) {
    const p = to.path.toLowerCase();
    if (!p.includes("api") && !p.includes("request")) continue;
    const label = to.label.toLowerCase();
    if (
      label.includes(nameLower) ||
      p.includes(nameLower) ||
      (pathLower.includes("login") && (label.includes("login") || p.includes("login")))
    ) {
      return to.path;
    }
  }

  for (const to of index.testObjects) {
    const p = to.path.toLowerCase();
    if (p.includes("api") && p.includes(method)) {
      return to.path;
    }
  }
  return null;
}

export function listRequestObjectPaths(endpoints: ApiEndpointSpec[], index: ProjectIndex | null): string[] {
  const paths = new Set<string>();
  for (const ep of endpoints) {
    const reused = matchProjectRequestObject(ep, index);
    paths.add(reused ?? toRequestObjectPath(ep));
  }
  return [...paths];
}
