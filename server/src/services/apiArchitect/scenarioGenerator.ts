import type { ApiEndpointSpec } from "../apiCodeGenerator/types.js";
import { BOUNDARY_STRING_SIZES } from "./constants.js";
import type { ApiTestScenario, EnrichedApiEndpoint } from "./types.js";
import { defaultMetadata } from "./types.js";
import {
  inferAuthErrorStatuses,
  inferNegativeStatuses,
  inferValidationErrorStatuses,
} from "./statusIntelligence.js";

function clonePayload(base: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
}

function boundaryStringSize(key: string): number {
  if (/desc|comment|note|body|message/i.test(key)) return BOUNDARY_STRING_SIZES.long;
  if (/email|name|title|code/i.test(key)) return BOUNDARY_STRING_SIZES.short;
  return BOUNDARY_STRING_SIZES.medium;
}

function repeatChar(n: number): string {
  return "A".repeat(Math.min(n, BOUNDARY_STRING_SIZES.long));
}

export function generateHappyScenarios(ep: EnrichedApiEndpoint): ApiTestScenario[] {
  return [
    {
      id: `${ep.id}:happy`,
      title: ep.businessAction,
      testType: "happy",
      riskLevel: "low",
      confidence: 0.94,
      expectedStatuses: [ep.successStatus],
      saveVars: ep.producesVars,
    },
  ];
}

export function generateNegativeScenarios(ep: EnrichedApiEndpoint): ApiTestScenario[] {
  const scenarios: ApiTestScenario[] = [];
  const base = ep.requestBodyExample;

  if (base && Object.keys(base).length > 0) {
    for (const [key, val] of Object.entries(base)) {
      if (/pass|password|secret/i.test(key) && typeof val === "string") {
        const payload = clonePayload(base);
        payload[key] = "invalid_credential_value";
        scenarios.push({
          id: `${ep.id}:neg:bad-${key}`,
          title: `Invalid ${key}`,
          testType: "negative",
          riskLevel: "medium",
          confidence: 0.9,
          expectedStatuses: inferNegativeStatuses(ep, "auth"),
          bodyOverride: payload,
          useInvalidToken: false,
        });
      }
      if (/user|email|login|name/i.test(key)) {
        const payload = clonePayload(base);
        payload[key] = "";
        scenarios.push({
          id: `${ep.id}:neg:empty-${key}`,
          title: `Empty ${key}`,
          testType: "negative",
          riskLevel: "low",
          confidence: 0.88,
          expectedStatuses: inferValidationErrorStatuses(),
          bodyOverride: payload,
        });
      }
      if (/status|type|role|category/i.test(key)) {
        const payload = clonePayload(base);
        payload[key] = "__INVALID_ENUM__";
        scenarios.push({
          id: `${ep.id}:neg:enum-${key}`,
          title: `Invalid enum ${key}`,
          testType: "negative",
          riskLevel: "medium",
          confidence: 0.85,
          expectedStatuses: inferValidationErrorStatuses(),
          bodyOverride: payload,
        });
      }
    }

    scenarios.push({
      id: `${ep.id}:neg:missing-body`,
      title: "Missing required body",
      testType: "negative",
      riskLevel: "medium",
      confidence: 0.87,
      expectedStatuses: inferValidationErrorStatuses(),
      bodyOverride: {},
    });

    scenarios.push({
      id: `${ep.id}:neg:malformed-json`,
      title: "Malformed JSON body",
      testType: "negative",
      riskLevel: "medium",
      confidence: 0.86,
      expectedStatuses: inferValidationErrorStatuses(),
      rawBody: "{ invalid-json ",
    });
  }

  if (ep.method === "GET" || ep.auth === "bearer" || ep.auth === "jwt") {
    scenarios.push({
      id: `${ep.id}:neg:no-auth`,
      title: "Without authorization",
      testType: "negative",
      riskLevel: "high",
      confidence: 0.91,
      expectedStatuses: inferAuthErrorStatuses(),
      skipAuth: true,
    });
  }

  return scenarios;
}

export function generateBoundaryScenarios(ep: EnrichedApiEndpoint): ApiTestScenario[] {
  const scenarios: ApiTestScenario[] = [];
  const base = ep.requestBodyExample;

  if (!base || !Object.keys(base).length) {
    scenarios.push({
      id: `${ep.id}:bnd:invalid-resource`,
      title: "Invalid resource reference",
      testType: "boundary",
      riskLevel: "low",
      confidence: 0.8,
      expectedStatuses: [400, 404, 422],
      pathOverride: ep.path.replace(/\{[^}]+\}/g, "999999999"),
    });
    return scenarios;
  }

  for (const [key, val] of Object.entries(base)) {
    const t = ep.fieldTypes?.[key] ?? typeof val;
    if (t === "string" || typeof val === "string") {
      const size = boundaryStringSize(key);
      const payload = clonePayload(base);
      payload[key] = repeatChar(size);
      scenarios.push({
        id: `${ep.id}:bnd:max-${key}`,
        title: `${key} max length (${size})`,
        testType: "boundary",
        riskLevel: "medium",
        confidence: 0.89,
        expectedStatuses: inferValidationErrorStatuses(),
        bodyOverride: payload,
      });

      const nullPayload = clonePayload(base);
      nullPayload[key] = null;
      scenarios.push({
        id: `${ep.id}:bnd:null-${key}`,
        title: `${key} null`,
        testType: "boundary",
        riskLevel: "low",
        confidence: 0.88,
        expectedStatuses: inferValidationErrorStatuses(),
        bodyOverride: nullPayload,
      });

      const emptyPayload = clonePayload(base);
      emptyPayload[key] = "";
      scenarios.push({
        id: `${ep.id}:bnd:empty-${key}`,
        title: `${key} empty string`,
        testType: "boundary",
        riskLevel: "low",
        confidence: 0.87,
        expectedStatuses: inferValidationErrorStatuses(),
        bodyOverride: emptyPayload,
      });

      if (/email|name|code/i.test(key)) {
        const specialPayload = clonePayload(base);
        specialPayload[key] = "<script>alert(1)</script>";
        scenarios.push({
          id: `${ep.id}:bnd:special-${key}`,
          title: `${key} special characters`,
          testType: "boundary",
          riskLevel: "medium",
          confidence: 0.84,
          expectedStatuses: inferValidationErrorStatuses(),
          bodyOverride: specialPayload,
        });
      }
    }

    if (t === "integer" || t === "number" || typeof val === "number") {
      const negPayload = clonePayload(base);
      negPayload[key] = -1;
      scenarios.push({
        id: `${ep.id}:bnd:neg-${key}`,
        title: `${key} negative value`,
        testType: "boundary",
        riskLevel: "medium",
        confidence: 0.86,
        expectedStatuses: inferValidationErrorStatuses(),
        bodyOverride: negPayload,
      });

      const hugePayload = clonePayload(base);
      hugePayload[key] = 999999999;
      scenarios.push({
        id: `${ep.id}:bnd:huge-${key}`,
        title: `${key} oversized number`,
        testType: "boundary",
        riskLevel: "medium",
        confidence: 0.85,
        expectedStatuses: inferValidationErrorStatuses(),
        bodyOverride: hugePayload,
      });
    }
  }

  return scenarios;
}

export function generateSecurityScenarios(ep: EnrichedApiEndpoint): ApiTestScenario[] {
  const scenarios: ApiTestScenario[] = [];

  if (ep.auth && ep.auth !== "none") {
    scenarios.push({
      id: `${ep.id}:sec:invalid-token`,
      title: "Expired / invalid token",
      testType: "security",
      riskLevel: "high",
      confidence: 0.92,
      expectedStatuses: inferAuthErrorStatuses(),
      useInvalidToken: true,
    });

    scenarios.push({
      id: `${ep.id}:sec:missing-auth-header`,
      title: "Missing Authorization header",
      testType: "security",
      riskLevel: "high",
      confidence: 0.93,
      expectedStatuses: inferAuthErrorStatuses(),
      skipAuth: true,
    });
  }

  const base = ep.requestBodyExample;
  if (base) {
    for (const [key, val] of Object.entries(base)) {
      if (typeof val === "string" && /user|email|search|query|name/i.test(key)) {
        const payload = clonePayload(base);
        payload[key] = "' OR '1'='1";
        scenarios.push({
          id: `${ep.id}:sec:injection-${key}`,
          title: `Injection attempt — ${key}`,
          testType: "security",
          riskLevel: "high",
          confidence: 0.8,
          expectedStatuses: inferValidationErrorStatuses(),
          bodyOverride: payload,
        });
        break;
      }
    }
  }

  return scenarios;
}

export function allScenariosForEndpoint(ep: EnrichedApiEndpoint, opts: {
  includeNegative: boolean;
  includeBoundary: boolean;
  includeSecurity: boolean;
}): ApiTestScenario[] {
  const list = [...generateHappyScenarios(ep)];
  if (opts.includeNegative) list.push(...generateNegativeScenarios(ep));
  if (opts.includeBoundary) list.push(...generateBoundaryScenarios(ep));
  if (opts.includeSecurity) list.push(...generateSecurityScenarios(ep));
  return list;
}

export function metadataForScenario(scenario: ApiTestScenario) {
  return defaultMetadata(scenario.testType, scenario.riskLevel, scenario.confidence);
}

/** Groovy status list literal */
export function groovyStatusList(codes: number[]): string {
  return `[${codes.join(", ")}]`;
}
