import type { ApiEndpointSpec, AuthType, HttpMethod } from "../apiCodeGenerator/types.js";

export type TestType = "happy" | "negative" | "boundary" | "security" | "performance";
export type RiskLevel = "low" | "medium" | "high";

export interface AiRequestMetadata {
  confidence: number;
  testType: TestType;
  riskLevel: RiskLevel;
  generatedBy: string;
}

export interface ProducedVariable {
  envKey: string;
  jsonPath: string;
  confidence: number;
}

export interface ApiTestScenario {
  id: string;
  title: string;
  testType: TestType;
  riskLevel: RiskLevel;
  confidence: number;
  expectedStatuses: number[];
  bodyOverride?: Record<string, unknown>;
  rawBody?: string;
  skipAuth?: boolean;
  useInvalidToken?: boolean;
  missingContentType?: boolean;
  pathOverride?: string;
  saveVars?: ProducedVariable[];
}

export interface EnrichedApiEndpoint extends ApiEndpointSpec {
  semanticModule: string;
  businessAction: string;
  pathTemplate: string;
  pathParams: string[];
  producesVars: ProducedVariable[];
  consumesVars: string[];
  successStatus: number;
  errorStatuses: number[];
  responseSchema?: Record<string, unknown>;
  nestedResponseFields: string[];
  openApiTags?: string[];
}

export function defaultMetadata(
  testType: TestType,
  riskLevel: RiskLevel = "medium",
  confidence = 0.88
): AiRequestMetadata {
  return {
    confidence,
    testType,
    riskLevel,
    generatedBy: "AI API Automation Architect",
  };
}

export type { ApiEndpointSpec, AuthType, HttpMethod };
