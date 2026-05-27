import type { ProjectGenerationMode } from "../projectIntelligence/types.js";

export type FrameworkKind =
  | "ui"
  | "api"
  | "mobile"
  | "performance"
  | "hybrid";

export type ArchitecturePattern =
  | "page-object"
  | "hybrid"
  | "keyword-driven"
  | "data-driven"
  | "bdd"
  | "layered"
  | "microservice-api";

export type ProjectSize = "starter" | "standard" | "enterprise";

export type DomainHint =
  | "ecommerce"
  | "banking"
  | "healthcare"
  | "saas"
  | "government"
  | "generic";

export type InputSourceKind =
  | "description"
  | "swagger"
  | "postman"
  | "jira"
  | "csv"
  | "flows"
  | "existing-project";

export interface ProjectGeneratorInput {
  projectName: string;
  description: string;
  frameworkKind: FrameworkKind;
  architecturePattern: ArchitecturePattern;
  domain: DomainHint;
  projectSize: ProjectSize;
  /** strict | balanced | generate_everything — mirrors Project Intelligence */
  reuseMode: ProjectGenerationMode;
  /** Optional indexed project to reuse OR/keywords/style */
  sourceProjectId?: string;
  inputSources: InputSourceKind[];
  businessFlows: string[];
  modules: string[];
  includeReporting: boolean;
  includeBdd: boolean;
  includePerformance: boolean;
  includeMobile: boolean;
  swaggerText?: string;
  postmanText?: string;
  jiraEpic?: string;
}

export interface GeneratedFile {
  path: string;
  kind:
    | "or"
    | "keyword"
    | "page"
    | "script"
    | "suite"
    | "listener"
    | "profile"
    | "data"
    | "api"
    | "mobile"
    | "performance"
    | "doc"
    | "config"
    | "ai";
  content: string;
  summary?: string;
}

export interface GeneratedModule {
  id: string;
  name: string;
  layer: "pages" | "keywords" | "api" | "mobile" | "performance" | "data" | "utils";
  fileCount: number;
}

export interface GeneratedPageObject {
  name: string;
  path: string;
  actions: string[];
  validations: string[];
}

export interface GeneratedKeyword {
  name: string;
  path: string;
  category: "auth" | "wait" | "api" | "util" | "mobile" | "reporting";
}

export interface GeneratedSuite {
  name: string;
  path: string;
  suiteType: "smoke" | "sanity" | "regression" | "api" | "critical";
  testCasePaths: string[];
}

export interface DependencyNode {
  id: string;
  label: string;
  layer: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  kind: "uses" | "extends" | "calls";
}

export interface FrameworkHealthReport {
  overallScore: number;
  orQuality: number;
  assertionQuality: number;
  modularityScore: number;
  duplicationRisk: number;
  flakyRisk: number;
  maintainabilityScore: number;
  findings: string[];
}

export interface ProjectGeneratorResult {
  generationId: string;
  projectName: string;
  frameworkType: FrameworkKind;
  architecturePattern: ArchitecturePattern;
  generatedAt: string;
  fromCache: boolean;
  healthScore: number;
  frameworkHealth: FrameworkHealthReport;
  generatedModules: GeneratedModule[];
  pages: GeneratedPageObject[];
  keywords: GeneratedKeyword[];
  apis: GeneratedKeyword[];
  suites: GeneratedSuite[];
  documentation: { path: string; title: string }[];
  files: GeneratedFile[];
  dependencyGraph: {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
  };
  warnings: string[];
  /** Relative path inside cache dir for zip download */
  zipPath?: string;
}

export interface ProjectGeneratorAnalyzeResult {
  generationId: string;
  projectName: string;
  inferredModules: string[];
  inferredFlows: string[];
  architectureSummary: string;
  recommendedPattern: ArchitecturePattern;
  estimatedFileCount: number;
  warnings: string[];
}

export interface ProjectGeneratorTemplate {
  id: string;
  name: string;
  description: string;
  frameworkKind: FrameworkKind;
  architecturePattern: ArchitecturePattern;
  defaultModules: string[];
}

export interface ProjectGeneratorAnalyzeOptions {
  input: ProjectGeneratorInput;
}

export interface ProjectGeneratorGenerateOptions {
  input: ProjectGeneratorInput;
  forceRefresh?: boolean;
}

export interface MigrationInput {
  sourceType: "postman" | "playwright" | "cypress" | "selenium";
  payload: string;
  projectName: string;
  targetPattern?: ArchitecturePattern;
}

export interface MigrationResult {
  generationId: string;
  projectName: string;
  files: GeneratedFile[];
  warnings: string[];
  zipPath?: string;
}
