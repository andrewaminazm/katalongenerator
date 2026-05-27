import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ApiCoverageSummary, CoverageRecommendation, MissingScenarioFinding } from "./types.js";

function extractOpenApiPaths(spec: string): string[] {
  const paths: string[] = [];
  try {
    const trimmed = spec.trim();
    if (trimmed.startsWith("{")) {
      const json = JSON.parse(trimmed) as { paths?: Record<string, unknown> };
      paths.push(...Object.keys(json.paths ?? {}));
    } else {
      const re = /^\s*(\/[\w{}/.-]+)\s*:/gm;
      let m: RegExpExecArray | null;
      while ((m = re.exec(spec)) !== null) {
        if (m[1]) paths.push(m[1]);
      }
    }
  } catch {
    /* ignore parse errors */
  }
  return [...new Set(paths)];
}

function extractPostmanPaths(collection: string): string[] {
  try {
    const json = JSON.parse(collection) as {
      item?: Array<{ name?: string; request?: { url?: string | { path?: string[] } } }>;
    };
    const paths: string[] = [];
    const walk = (items: typeof json.item) => {
      for (const it of items ?? []) {
        const url = it.request?.url;
        if (typeof url === "string") {
          try {
            const u = new URL(url, "http://localhost");
            paths.push(u.pathname);
          } catch {
            paths.push(url);
          }
        } else if (url?.path) {
          paths.push("/" + url.path.filter(Boolean).join("/"));
        }
        if ((it as { item?: unknown }).item) walk((it as { item: typeof json.item }).item);
      }
    };
    walk(json.item);
    return [...new Set(paths)];
  } catch {
    return [];
  }
}

export function analyzeApiCoverage(
  index: ProjectIndex,
  swagger?: string,
  postmanCollection?: string
): {
  summary?: ApiCoverageSummary;
  missing: MissingScenarioFinding[];
  recommendations: CoverageRecommendation[];
} {
  const specPaths = [
    ...extractOpenApiPaths(swagger ?? ""),
    ...extractPostmanPaths(postmanCollection ?? ""),
  ].filter(Boolean);

  if (specPaths.length === 0) {
    return { missing: [], recommendations: [] };
  }

  const orPaths = index.testObjects
    .filter((o) => /\/API\//i.test(o.path) || /request/i.test(o.path))
    .map((o) => o.path.toLowerCase());

  const scriptText = (index.testScripts ?? [])
    .map((s) => `${s.scriptPath} ${s.semanticSummary} ${s.findTestObjectRefs.join(" ")}`)
    .join(" ")
    .toLowerCase();

  const referencedInOr = specPaths.filter((p) =>
    orPaths.some((o) => o.includes(p.toLowerCase().replace(/^\//, "")))
  );
  const referencedInScripts = specPaths.filter((p) =>
    scriptText.includes(p.toLowerCase().replace(/^\//, ""))
  );
  const covered = new Set([...referencedInOr, ...referencedInScripts]);
  const untested = specPaths.filter((p) => !covered.has(p));

  const missing: MissingScenarioFinding[] = untested.slice(0, 30).map((p, i) => ({
    id: `api-missing-${i}`,
    module: "API",
    scenario: `No automation reference detected for ${p}`,
    severity: "high",
    source: "api",
  }));

  const recommendations: CoverageRecommendation[] = [];
  if (untested.length > 0) {
    recommendations.push({
      id: "api-untested",
      severity: "high",
      category: "api",
      title: `${untested.length} API path(s) appear untested`,
      detail: "Add WS.sendRequest coverage, status validations, and auth chaining for these endpoints.",
      affectedItems: untested.slice(0, 12),
    });
  }

  recommendations.push({
    id: "api-negative",
    severity: "medium",
    category: "api",
    title: "Review negative and security API scenarios",
    detail: "Ensure 401/403/404/422 and token expiry flows exist for auth and payment endpoints.",
  });

  const summary: ApiCoverageSummary = {
    totalEndpoints: specPaths.length,
    referencedInOr: referencedInOr.length,
    referencedInScripts: referencedInScripts.length,
    untestedEndpoints: untested,
    missingStatusValidations: [],
    coveragePercent: specPaths.length
      ? Math.round((covered.size / specPaths.length) * 100)
      : 0,
  };

  return { summary, missing, recommendations };
}
