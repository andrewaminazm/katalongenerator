import type { GroovyUtilityIntent } from "../testDsl/groovyUtilityIntent.js";
import type { ParsedKeywordClass } from "../projectIntelligence/types.js";

export type ArchitectureComponentKind =
  | "reusable_helper"
  | "page_object"
  | "api_helper"
  | "db_utility"
  | "framework_service"
  | "data_generator"
  | "custom_keyword"
  | "generic_utility";

export interface ArchitectureFeatures {
  retry: boolean;
  screenshot: boolean;
  logging: boolean;
  sessionValidation: boolean;
  waits: boolean;
  exceptions: boolean;
}

export interface ArchitectureIntent {
  raw: string;
  confidence: number;
  kind: ArchitectureComponentKind;
  subject: string;
  platform: "web" | "mobile" | "api" | "utility";
  features: ArchitectureFeatures;
  /** Underlying utility intent for legacy compatibility */
  utilityIntent: GroovyUtilityIntent;
}

export interface ArchitecturePlan {
  intent: ArchitectureIntent;
  className: string;
  primaryMethod: string;
  packageName: string;
  /** CustomKeywords paths to prefer from project index */
  projectReuse: {
    retryHelper?: string;
    screenshotHelper?: string;
    waitHelper?: string;
    loginKeyword?: string;
  };
}

export interface ArchitectureBuildContext {
  plan: ArchitecturePlan;
  projectKeywords?: ParsedKeywordClass[];
  projectHint?: string;
  aiMemoryInjection?: string;
  authorizationToken?: string;
  model?: string;
  forceDeterministic?: boolean;
}

export interface ArchitectureBuildResult {
  code: string;
  model: string;
  warnings: string[];
  validationErrors: string[];
  validationStage?: "groovy";
  componentKind: ArchitectureComponentKind;
  className: string;
  methodName: string;
  synthesizedBy: "architecture" | "template" | "ai" | "generic";
  architecture: {
    features: ArchitectureFeatures;
    buildersUsed: string[];
  };
}
