import type { EnrichedApiEndpoint } from "../apiArchitect/types.js";

export type PerformanceInputType = "openapi" | "postman" | "curl" | "endpoint" | "project";
export type PerformanceMode = "smoke" | "baseline" | "stress" | "spike" | "soak";
export type PerformanceEnvironment = "local" | "qa" | "staging" | "production";

export interface PerformanceConfig {
  vus: number;
  duration: string;
  rampUp: string;
  environment?: PerformanceEnvironment;
  baseUrl?: string;
}

export interface PerformanceGenerateRequest {
  inputType?: PerformanceInputType;
  input?: Record<string, unknown>;
  swagger?: string;
  spec?: string;
  collection?: string;
  curl?: string;
  method?: string;
  path?: string;
  url?: string;
  requestJson?: string;
  responseJson?: string;
  mode?: PerformanceMode;
  config?: PerformanceConfig;
  projectId?: string;
  testCaseName?: string;
  useProjectApis?: boolean;
  output?: ("jmeter" | "k6" | "strategy")[];
}

export type ApiLoadCategory = "auth" | "read" | "write" | "search" | "payment" | "default";

export interface ClassifiedEndpoint extends EnrichedApiEndpoint {
  loadCategory: ApiLoadCategory;
  suggestedVus: number;
  maxRpsHint: number;
  critical: boolean;
}

export interface PerformanceScenario {
  id: string;
  name: string;
  module: string;
  endpoints: string[];
  vus: number;
  duration: string;
  rampUp: string;
  description: string;
}

export interface LoadModel {
  mode: PerformanceMode;
  totalVus: number;
  duration: string;
  rampUp: string;
  stages: { duration: string; target: number }[];
  perCategory: Record<ApiLoadCategory, { vus: number; weight: number }>;
}

export interface StrategyReport {
  scenarios: PerformanceScenario[];
  loadModel: LoadModel;
  riskAnalysis: string[];
  slaRecommendations: string[];
  bottleneckHints: string[];
  dependencyRisks: string[];
}

export interface PerformanceGenerateResult {
  jmeter: string;
  k6: string;
  strategy: StrategyReport;
  warnings: string[];
  baseUrl: string;
  endpointCount: number;
}
