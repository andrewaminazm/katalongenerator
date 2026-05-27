import { enrichEndpointsInPlace } from "../apiArchitect/index.js";
import { loadProjectIndex } from "../projectIntelligence/projectStore.js";
import { resolvePostmanInput } from "./inputResolver.js";
import { buildPostmanCollectionV21 } from "./postmanCollectionBuilder.js";
import { buildEnvironments } from "./postmanEnvironmentGenerator.js";
import type { PostmanGenerateRequest, PostmanGenerateResult } from "./types.js";

export * from "./types.js";

export async function generatePostmanCollection(
  req: PostmanGenerateRequest
): Promise<PostmanGenerateResult> {
  const resolved = resolvePostmanInput(req);
  enrichEndpointsInPlace(resolved.endpoints);
  const warnings = [...resolved.warnings];
  warnings.push(
    "Semantic modules: endpoints grouped by business domain (Authentication, Users, Orders, etc.)."
  );

  if (req.projectId) {
    try {
      const index = await loadProjectIndex(req.projectId);
      if (index) {
        warnings.push(
          `Project ${index.projectName}: reuse naming from indexed API RequestObjects where applicable.`
        );
      }
    } catch {
      warnings.push(`Project ${req.projectId} not found for intelligence hints.`);
    }
  }

  if (req.aiMemoryEnabled || req.aiMemoryMode) {
    warnings.push("AI memory: prefer team folder and assertion naming when reviewing generated collection.");
  }

  const { collection, generatedTests, warnings: buildWarnings } = buildPostmanCollectionV21(
    resolved,
    {
      includeNegative: req.includeNegative !== false,
      includeBoundary: req.includeBoundary !== false,
      useFlowOrder: req.generatedApiFlow !== false,
    }
  );

  warnings.push(...buildWarnings);

  const environments = buildEnvironments(resolved.baseUrl, resolved.primaryAuth).map((e) => ({
    ...e,
    values: e.values.map((v) => ({
      ...v,
      value: v.key === "password" ? "" : v.value,
    })),
  }));

  warnings.push(
    "Set baseUrl, token, username, and password in Postman environments — never hardcode secrets in the collection."
  );

  const collectionJson = JSON.stringify(collection, null, 2);

  return {
    collection,
    environments,
    warnings,
    generatedTests,
    collectionJson,
  };
}
