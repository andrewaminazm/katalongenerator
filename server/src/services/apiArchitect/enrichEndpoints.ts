import type { ApiEndpointSpec } from "../apiCodeGenerator/types.js";
import {
  buildResourceCatalog,
  extractPathParams,
  inferConsumesVars,
  inferProducesVars,
  pathToTemplate,
} from "./relationshipAnalyzer.js";
import { enrichResponseMetadata } from "./responseIntelligence.js";
import { businessActionLabel, classifySemanticModule } from "./semanticClassifier.js";
import { jsonSchemaFromExample } from "./schemaFromExample.js";
import { inferSuccessStatus } from "./statusIntelligence.js";
import type { EnrichedApiEndpoint } from "./types.js";

export function enrichEndpoint(ep: ApiEndpointSpec, catalog: ReturnType<typeof buildResourceCatalog>): EnrichedApiEndpoint {
  const responseMeta = enrichResponseMetadata(ep);
  const pathParams = extractPathParams(ep.path);
  const producesVars = inferProducesVars(ep);
  const consumesVars = inferConsumesVars(ep, catalog);

  const varMap: Record<string, string> = {};
  for (const param of pathParams) {
    const key = catalog.find((c) => c.envKey === param || c.jsonPath === param)?.envKey ?? param;
    varMap[param] = key;
  }

  const responseSchema = jsonSchemaFromExample(ep.responseExample, ep.requiredFields);

  return {
    ...ep,
    responseFields: responseMeta.responseFields,
    fieldTypes: responseMeta.fieldTypes,
    semanticModule: classifySemanticModule(ep),
    businessAction: businessActionLabel(ep),
    pathTemplate: pathToTemplate(ep.path, varMap),
    pathParams,
    producesVars,
    consumesVars,
    successStatus: inferSuccessStatus(ep),
    errorStatuses: [400, 401, 422],
    responseSchema,
    nestedResponseFields: responseMeta.nestedResponseFields,
  };
}

export function enrichEndpoints(endpoints: ApiEndpointSpec[]): EnrichedApiEndpoint[] {
  const catalog = buildResourceCatalog(endpoints);
  return endpoints.map((ep) => enrichEndpoint(ep, catalog));
}

export function enrichEndpointsInPlace(endpoints: ApiEndpointSpec[]): EnrichedApiEndpoint[] {
  const enriched = enrichEndpoints(endpoints);
  for (let i = 0; i < endpoints.length; i++) {
    Object.assign(endpoints[i], enriched[i]);
  }
  return enriched as EnrichedApiEndpoint[];
}
