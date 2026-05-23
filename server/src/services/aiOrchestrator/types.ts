import type { Platform } from "../../types/index.js";
import type { UserGenerationMode } from "../groovyGenerator/generationModeRouter.js";
import type { AiMemoryMode } from "../aiMemory/types.js";
import type { ProjectGenerationMode } from "../projectIntelligence/types.js";
import type { LintIssue } from "../../types/index.js";

export type OrchestrationMode =
  | "basic"
  | "advanced"
  | "autonomous"
  | "architecture_review"
  | "self_healing"
  | "conversational";

export type AutomationIntentType =
  | "testGeneration"
  | "keywordGeneration"
  | "utilityGeneration"
  | "pageObjectGeneration"
  | "apiGeneration"
  | "dbUtilityGeneration"
  | "frameworkArchitecture"
  | "frameworkRefactor"
  | "frameworkOptimization"
  | "flakyTestAnalysis"
  | "locatorHealing"
  | "debugging"
  | "codeReview"
  | "performanceAnalysis"
  | "migration"
  | "conversationalAdvice"
  | "mixedIntent"
  | "projectAnalysis"
  | "unknown";

export type GeneratorKind =
  | "deterministicCompiler"
  | "keywordGenerator"
  | "utilityGenerator"
  | "architectureGenerator"
  | "pageObjectGenerator"
  | "apiHelperGenerator"
  | "dbUtilityGenerator"
  | "refactorEngine"
  | "debuggingEngine"
  | "optimizationEngine"
  | "conversationalEngine";

export type AgentRole =
  | "katalonExpert"
  | "groovyFramework"
  | "debugging"
  | "refactor"
  | "optimization"
  | "validation"
  | "security";

export interface OrchestratorInput {
  platform: Platform;
  /** Primary user text — steps joined or free-form engineering prompt */
  prompt: string;
  steps?: string[];
  locators?: string;
  url?: string;
  projectId?: string;
  projectGenerationMode?: ProjectGenerationMode;
  codeGenerationMode?: UserGenerationMode;
  aiMemoryMode?: AiMemoryMode;
  orchestrationMode?: OrchestrationMode;
  deterministicCompiler?: boolean;
  authorizationToken?: string;
  model?: string;
  testCaseName?: string;
  stylePass?: "none" | "simplify" | "match-project";
}

export interface IntentAnalysis {
  primary: AutomationIntentType;
  secondary: AutomationIntentType[];
  confidence: number;
  ambiguous: boolean;
  complexity: "low" | "medium" | "high";
  entities: {
    subjects: string[];
    mentionsRetry: boolean;
    mentionsScreenshot: boolean;
    mentionsSession: boolean;
    mentionsPageObject: boolean;
    mentionsApi: boolean;
    mentionsDb: boolean;
    mentionsFlaky: boolean;
    mentionsPerformance: boolean;
    mentionsLogin: boolean;
  };
  clarifyingQuestion?: string;
  raw: string;
}

export interface PlannedTask {
  id: string;
  intent: AutomationIntentType;
  generator: GeneratorKind;
  agent: AgentRole;
  description: string;
  steps: string[];
  dependsOn: string[];
  priority: number;
}

export interface ExecutionPlan {
  tasks: PlannedTask[];
  parallel: boolean;
  mode: OrchestrationMode;
}

export interface OrchestratorContext {
  projectId?: string;
  projectHint?: string;
  aiMemoryInjection?: string;
  styleProfileSummary?: string;
  reusableFlowHints: string[];
  healingHints: string[];
  conversationPrefs: string[];
  mergedLocators?: string;
  projectDefaultUrl?: string;
}

export interface TaskArtifact {
  taskId: string;
  generator: GeneratorKind;
  agent: AgentRole;
  code: string;
  model: string;
  warnings: string[];
  validationErrors: string[];
  generationMode?: string;
  metadata?: Record<string, unknown>;
}

export interface ConfidenceReport {
  intent: number;
  architecture: number;
  style: number;
  validation: number;
  overall: number;
}

export interface OrchestratorResult {
  ok: boolean;
  code: string;
  model: string;
  intent: IntentAnalysis;
  plan: ExecutionPlan;
  artifacts: TaskArtifact[];
  warnings: string[];
  lint?: LintIssue[];
  confidence: ConfidenceReport;
  orchestration: {
    mode: OrchestrationMode;
    agentsUsed: AgentRole[];
    generatorsUsed: GeneratorKind[];
    repairAttempts: number;
  };
  conversationalResponse?: string;
  suggestions?: string[];
  /** Pass-through fields for existing UI */
  generationMode?: string;
  groovyUtility?: Record<string, unknown>;
  keywordTemplate?: Record<string, unknown>;
  projectIntelligence?: Record<string, unknown>;
  aiMemory?: Record<string, unknown>;
}
