import type { ApiEndpointSpec, AuthType } from "../apiCodeGenerator/types.js";

export type PostmanInputType = "swagger" | "endpoint" | "curl" | "postman" | "flow";

export interface PostmanGenerateRequest {
  inputType?: PostmanInputType;
  swagger?: string;
  spec?: string;
  collection?: string;
  curl?: string;
  method?: string;
  path?: string;
  url?: string;
  requestJson?: string;
  responseJson?: string;
  testCaseName?: string;
  endpoints?: ApiEndpointSpec[];
  generatedApiFlow?: boolean;
  projectId?: string;
  aiMemoryEnabled?: boolean;
  aiMemoryMode?: string;
  includeNegative?: boolean;
  includeBoundary?: boolean;
  baseUrl?: string;
}

export interface PostmanEnvironment {
  id: string;
  name: string;
  values: { key: string; value: string; enabled: boolean; type?: string }[];
}

export interface PostmanGenerateResult {
  collection: Record<string, unknown>;
  environments: PostmanEnvironment[];
  warnings: string[];
  generatedTests: string[];
  collectionJson: string;
}

export interface ResolvedPostmanInput {
  endpoints: ApiEndpointSpec[];
  warnings: string[];
  collectionName: string;
  baseUrl: string;
  primaryAuth: AuthType;
}
