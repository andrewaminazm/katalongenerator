import type { EnrichedApiEndpoint } from "../apiArchitect/types.js";
import {
  enterpriseHappyPathTests,
  enterpriseScenarioTests,
  postTestSaveVarsBlock,
  standardPrerequestScripts,
} from "../apiArchitect/assertionScripts.js";
import type { ApiTestScenario } from "../apiArchitect/types.js";
import { metadataForScenario } from "../apiArchitect/scenarioGenerator.js";

export function happyPathTests(ep: EnrichedApiEndpoint, saveToken: boolean): string[] {
  return enterpriseHappyPathTests(ep, saveToken);
}

export function scenarioTests(scenario: ApiTestScenario): string[] {
  return enterpriseScenarioTests(scenario.expectedStatuses);
}

export function prerequestForScenario(
  ep: EnrichedApiEndpoint,
  scenario: ApiTestScenario,
  globalAuth: string
): string[] {
  const lines = [...standardPrerequestScripts()];

  if (scenario.useInvalidToken) {
    lines.push(
      "pm.request.headers.upsert({ key: 'Authorization', value: 'Bearer invalid_expired_token_000' });"
    );
    return lines;
  }

  if (scenario.skipAuth) {
    lines.push("pm.request.headers.remove('Authorization');");
    return lines;
  }

  if (globalAuth === "bearer" || globalAuth === "jwt") {
    lines.push(
      "if (pm.environment.get('authToken') || pm.environment.get('token')) {",
      "    const t = pm.environment.get('authToken') || pm.environment.get('token');",
      "    pm.request.headers.upsert({ key: 'Authorization', value: 'Bearer ' + t });",
      "}"
    );
  }

  return lines;
}

export function postTestSaveVars(scenario: ApiTestScenario): string[] {
  return postTestSaveVarsBlock(scenario);
}

export function aiMetadataComment(scenario: ApiTestScenario): string {
  const meta = metadataForScenario(scenario);
  return `AI metadata: ${JSON.stringify(meta)}`;
}

export function testEvent(exec: string[], listen: "test" | "prerequest" = "test"): Record<string, unknown> {
  return {
    listen,
    script: {
      type: "text/javascript",
      exec,
    },
  };
}

/** @deprecated use scenarioTests */
export function negativeTests(expectedStatus: number): string[] {
  return enterpriseScenarioTests([expectedStatus]);
}
