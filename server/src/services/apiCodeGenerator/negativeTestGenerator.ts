import type { ApiEndpointSpec } from "./types.js";
import { toRequestObjectPath } from "./requestObjectBuilder.js";
import {
  UniqueVarNames,
  emitGroovyMapLiteral,
  emitPayloadSendBlock,
  endpointVarPrefix,
} from "./groovyEmit.js";

function clonePayload(base: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
}

export function generateNegativeTests(
  endpoint: ApiEndpointSpec,
  requestPath: string,
  vars: UniqueVarNames
): { lines: string[]; titles: string[] } {
  const lines: string[] = [];
  const titles: string[] = [];
  const base = endpoint.requestBodyExample;

  if (base && Object.keys(base).length > 0) {
    for (const [key, val] of Object.entries(base)) {
      if (/pass|password|secret/i.test(key) && typeof val === "string") {
        const payload = clonePayload(base);
        payload[key] = "invalid_" + val + "_wrong";
        const block = emitPayloadSendBlock({
          vars,
          requestPath,
          payload,
          scenarioSuffix: `Invalid${key}`,
          expectedStatus: 401,
          title: `Negative: invalid ${key}`,
          comment: "Mutated credential — expect 401 Unauthorized",
          useContinueOnFailure: true,
        });
        lines.push(...block.lines);
        titles.push(`invalid ${key}`);
      }

      if (/user|email|login|name/i.test(key)) {
        const payload = clonePayload(base);
        payload[key] = "";
        const block = emitPayloadSendBlock({
          vars,
          requestPath,
          payload,
          scenarioSuffix: `Empty${key}`,
          expectedStatus: 400,
          title: `Negative: empty ${key}`,
          useContinueOnFailure: true,
        });
        lines.push(...block.lines);
        titles.push(`empty ${key}`);
      }
    }

    const missingPayload: Record<string, unknown> = {};
    const blockMissing = emitPayloadSendBlock({
      vars,
      requestPath,
      payload: missingPayload,
      scenarioSuffix: "MissingBody",
      expectedStatus: 400,
      title: "Negative: missing required body fields",
      comment: "Empty JSON object — required fields absent",
      useContinueOnFailure: true,
    });
    lines.push(...blockMissing.lines);
    titles.push("missing payload");

    const malformedVar = vars.request("Malformed");
    const responseMalformed = vars.response("MalformedJson");
    lines.push(
      "",
      "// Negative: malformed JSON body",
      `RequestObject ${malformedVar} = ApiRequestBuilder.prepare('${requestPath}')`,
      `${malformedVar} = ApiPayloadBuilder.withRawBody(${malformedVar}, '{ invalid json ')`,
      `def ${responseMalformed} = WS.sendRequest(${malformedVar}, FailureHandling.CONTINUE_ON_FAILURE)`,
      `ResponseValidator.assertStatus(${responseMalformed}, 400)`
    );
    titles.push("malformed JSON");
  } else if (endpoint.method === "GET") {
    const responseVar = vars.response("UnauthorizedGet");
    lines.push(
      "",
      "// Negative: GET without auth (if required)",
      `RequestObject ${vars.request("GetNoAuth")} = ApiRequestBuilder.prepare('${requestPath}')`,
      `def ${responseVar} = WS.sendRequest(${vars.request("GetNoAuth")}, FailureHandling.CONTINUE_ON_FAILURE)`,
      `ResponseValidator.assertStatus(${responseVar}, 401)`
    );
    titles.push("unauthorized GET");
  }

  if (endpoint.auth === "bearer" || endpoint.auth === "jwt") {
    const reqVar = vars.request("InvalidToken");
    const resVar = vars.response("InvalidToken");
    const payloadVar = vars.payload("InvalidToken");
    lines.push(
      "",
      "// Negative: invalid bearer token on request",
      `RequestObject ${reqVar} = ApiRequestBuilder.prepare('${requestPath}')`,
      `${reqVar}.addHttpHeaderProperties([`,
      `    new com.kms.katalon.core.testobject.TestObjectProperty('Authorization', 'Bearer invalid-token-for-test')`,
      `])`
    );
    if (base) {
      lines.push(`Map ${payloadVar} = ${emitGroovyMapLiteral(clonePayload(base))}`);
      lines.push(`${reqVar} = ApiPayloadBuilder.withBody(${reqVar}, ${payloadVar})`);
    }
    lines.push(
      `def ${resVar} = WS.sendRequest(${reqVar}, FailureHandling.CONTINUE_ON_FAILURE)`,
      `ResponseValidator.assertStatus(${resVar}, 401)`
    );
    titles.push("invalid token");
  }

  if (!lines.length) {
    const block = emitPayloadSendBlock({
      vars,
      requestPath,
      payload: {},
      scenarioSuffix: "ClientError",
      expectedStatus: 400,
      title: "Negative: expect client error",
      useContinueOnFailure: true,
    });
    lines.push(...block.lines);
    titles.push("client error");
  }

  return { lines, titles };
}

export function generateNegativeTestsForAll(
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
    const { lines, titles: t } = generateNegativeTests(ep, path, vars);
    groovyFragments.push(...lines);
    titles.push(...t.map((x) => `${ep.name}: ${x}`));
  }
  return { groovyFragments, titles };
}
