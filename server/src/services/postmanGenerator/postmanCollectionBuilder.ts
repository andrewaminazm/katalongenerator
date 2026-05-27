import { collectionAuth } from "./postmanAuthGenerator.js";
import { collectionVariables } from "./postmanVariableResolver.js";
import {
  buildBoundaryFolder,
  buildHappyPathFolders,
  buildNegativeFolder,
  buildSecurityFolder,
} from "./postmanFolderOrganizer.js";
import { standardPrerequestScripts } from "../apiArchitect/assertionScripts.js";
import { testEvent } from "./postmanTestScriptGenerator.js";
import type { EnrichedApiEndpoint } from "../apiArchitect/types.js";
import { orderEndpointsForFlow, flowWarnings } from "./postmanFlowGenerator.js";
import type { ResolvedPostmanInput } from "./types.js";

export interface BuildCollectionOptions {
  includeNegative?: boolean;
  includeBoundary?: boolean;
  useFlowOrder?: boolean;
}

export function buildPostmanCollectionV21(
  resolved: ResolvedPostmanInput,
  options: BuildCollectionOptions = {}
): { collection: Record<string, unknown>; generatedTests: string[]; warnings: string[] } {
  const generatedTests: string[] = [];
  const warnings = [...resolved.warnings, ...flowWarnings(resolved.endpoints)];

  const enriched = resolved.endpoints as EnrichedApiEndpoint[];
  const endpoints = (
    options.useFlowOrder !== false ? orderEndpointsForFlow(enriched) : enriched
  ) as EnrichedApiEndpoint[];

  const items = buildHappyPathFolders(endpoints, resolved.primaryAuth, generatedTests);

  if (options.includeNegative !== false) {
    const neg = buildNegativeFolder(enriched, resolved.primaryAuth, generatedTests);
    if (neg) items.push(neg);
  }

  if (options.includeBoundary !== false) {
    const bnd = buildBoundaryFolder(enriched, resolved.primaryAuth, generatedTests);
    if (bnd) items.push(bnd);
  }

  const sec = buildSecurityFolder(enriched, resolved.primaryAuth, generatedTests);
  if (sec) items.push(sec);

  const collectionEvents = [testEvent(standardPrerequestScripts(), "prerequest")];

  const collection: Record<string, unknown> = {
    info: {
      _postman_id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: resolved.collectionName,
      description:
        "AI API Automation Architect — semantic folders, chained variables, schema-aware tests. Import into Postman. Use environments for secrets.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    item: items,
    event: collectionEvents,
    variable: collectionVariables(resolved.baseUrl, resolved.primaryAuth).map((v) => ({
      key: v.key,
      value: v.value,
    })),
  };

  const auth = collectionAuth(resolved.primaryAuth);
  if (auth) collection.auth = auth;

  return { collection, generatedTests, warnings };
}
