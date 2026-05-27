export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export type AuthType = "none" | "bearer" | "basic" | "apiKey" | "oauth2" | "jwt";

export interface ApiEndpointSpec {
  id: string;
  name: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  requestBodyExample?: Record<string, unknown>;
  responseExample?: Record<string, unknown>;
  responseFields?: string[];
  auth?: AuthType;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  requiredFields?: string[];
  fieldTypes?: Record<string, string>;
  /** Set by apiArchitect enrichment */
  semanticModule?: string;
  businessAction?: string;
  pathTemplate?: string;
  pathParams?: string[];
  successStatus?: number;
  errorStatuses?: number[];
  openApiTags?: string[];
}

export interface ApiGeneratorOptions {
  projectId?: string;
  testCaseName?: string;
  includeNegative?: boolean;
  includeBoundary?: boolean;
  includeHelpers?: boolean;
  aiMemoryMode?: string;
}

export interface ApiGenerationPreview {
  endpoints: { method: string; path: string; name: string; auth?: string }[];
  authType: string;
  validationStrategy: string;
  scenarioCount: number;
  semanticModules?: string[];
}

export interface GeneratedGroovyFile {
  /** Katalon-relative path, e.g. Keywords/api/ApiPayloadBuilder.groovy */
  path: string;
  kind: "keyword" | "script";
  content: string;
}

export interface ApiCodegenResult {
  /** Primary test script (Scripts/API/*) — same as files[script].content */
  groovyCode: string;
  files: GeneratedGroovyFile[];
  requestObjects: string[];
  schemaAssertions: string[];
  negativeTests: string[];
  boundaryTests: string[];
  reusableHelpers: string[];
  warnings: string[];
  preview: ApiGenerationPreview;
}
