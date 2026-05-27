import { BOUNDARY_STRING_SIZES } from "../apiArchitect/constants.js";
import { groovyStatusList } from "../apiArchitect/scenarioGenerator.js";
import type { ApiEndpointSpec } from "./types.js";
import { toRequestObjectPath } from "./requestObjectBuilder.js";
import {
  UniqueVarNames,
  emitGroovyMapLiteralWithOverrides,
  emitOversizedString,
  emitPayloadSendBlock,
  endpointVarPrefix,
} from "./groovyEmit.js";

function clonePayload(base: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
}

export function generateBoundaryTests(
  endpoint: ApiEndpointSpec,
  requestPath: string,
  vars: UniqueVarNames
): { lines: string[]; titles: string[] } {
  const lines: string[] = [];
  const titles: string[] = [];
  const base = endpoint.requestBodyExample;

  if (!base || !Object.keys(base).length) {
    const reqVar = vars.request("InvalidPath");
    const resVar = vars.response("InvalidPath");
    lines.push(
      "",
      `// Boundary: ${endpoint.name} — expect client error for invalid resource`,
      `RequestObject ${reqVar} = ApiRequestBuilder.prepare('${requestPath}')`,
      `def ${resVar} = WS.sendRequest(${reqVar}, FailureHandling.CONTINUE_ON_FAILURE)`,
      `ApiRequestBuilder.sendExpecting(${reqVar}, [400, 404, 422])`
    );
    titles.push("invalid path");
    return { lines, titles };
  }

  for (const [key, val] of Object.entries(base)) {
    const t = endpoint.fieldTypes?.[key] ?? typeof val;

    if (t === "string" || typeof val === "string") {
      const payloadMaxVar = vars.payload(`Max${key}`);
      const requestMaxVar = vars.request(`Max${key}`);
      const responseMaxVar = vars.response(`Max${key}`);
      lines.push(
        "",
        `// Boundary: ${key} max length (${BOUNDARY_STRING_SIZES.medium} chars)`,
        `Map ${payloadMaxVar} = ${emitGroovyMapLiteralWithOverrides(clonePayload(base), {
          [key]: emitOversizedString(BOUNDARY_STRING_SIZES.medium),
        })}`,
        `RequestObject ${requestMaxVar} = ApiRequestBuilder.prepare('${requestPath}')`,
        `${requestMaxVar} = ApiPayloadBuilder.withBody(${requestMaxVar}, ${payloadMaxVar})`,
        `def ${responseMaxVar} = WS.sendRequest(${requestMaxVar}, FailureHandling.CONTINUE_ON_FAILURE)`,
        `ApiRequestBuilder.sendExpecting(${requestMaxVar}, ${groovyStatusList([400, 422])})`
      );
      titles.push(`${key} max length`);

      const emptyBlock = emitPayloadSendBlock({
        vars,
        requestPath,
        payload: { ...clonePayload(base), [key]: "" },
        scenarioSuffix: `Empty${key}`,
        expectedStatus: 400,
        title: `Boundary: ${key} empty string`,
        useContinueOnFailure: true,
      });
      lines.push(...emptyBlock.lines);
      titles.push(`${key} empty`);

      const nullBlock = emitPayloadSendBlock({
        vars,
        requestPath,
        payload: { ...clonePayload(base), [key]: null },
        scenarioSuffix: `Null${key}`,
        expectedStatus: 400,
        title: `Boundary: ${key} null`,
        useContinueOnFailure: true,
      });
      lines.push(...nullBlock.lines);
      titles.push(`${key} null`);
    }

    if (t === "integer" || t === "number" || typeof val === "number") {
      const negBlock = emitPayloadSendBlock({
        vars,
        requestPath,
        payload: { ...clonePayload(base), [key]: -1 },
        scenarioSuffix: `Negative${key}`,
        expectedStatus: 400,
        title: `Boundary: ${key} negative value`,
        useContinueOnFailure: true,
      });
      lines.push(...negBlock.lines);
      titles.push(`${key} negative`);

      const hugeBlock = emitPayloadSendBlock({
        vars,
        requestPath,
        payload: { ...clonePayload(base), [key]: 999999999 },
        scenarioSuffix: `Huge${key}`,
        expectedStatus: 400,
        title: `Boundary: ${key} extreme max`,
        useContinueOnFailure: true,
      });
      lines.push(...hugeBlock.lines);
      titles.push(`${key} extreme`);
    }

    if (t === "string" && /enum|status|type|role/i.test(key)) {
      const enumBlock = emitPayloadSendBlock({
        vars,
        requestPath,
        payload: { ...clonePayload(base), [key]: "INVALID_ENUM_VALUE_XYZ" },
        scenarioSuffix: `BadEnum${key}`,
        expectedStatus: 400,
        title: `Boundary: ${key} invalid enum`,
        useContinueOnFailure: true,
      });
      lines.push(...enumBlock.lines);
      titles.push(`${key} invalid enum`);
    }
  }

  return { lines, titles };
}

export function generateBoundaryTestsForAll(
  endpoints: ApiEndpointSpec[],
  requestPaths: Map<string, string>,
  varsByEndpoint: Map<string, UniqueVarNames>
): { groovyFragments: string[]; titles: string[] } {
  const groovyFragments: string[] = [];
  const titles: string[] = [];
  for (const ep of endpoints) {
    const path = requestPaths.get(ep.id) ?? toRequestObjectPath(ep);
    const vars =
      varsByEndpoint.get(ep.id) ?? new UniqueVarNames(endpointVarPrefix(ep.name));
    const { lines, titles: t } = generateBoundaryTests(ep, path, vars);
    groovyFragments.push(...lines);
    titles.push(...t.map((x) => `${ep.name}: ${x}`));
  }
  return { groovyFragments, titles };
}
