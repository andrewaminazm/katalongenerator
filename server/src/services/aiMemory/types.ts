/** UI / API mode for AI Memory behavior */
export type AiMemoryMode = "disabled" | "learn_only" | "learn_suggest" | "adaptive";

export interface NamingConventionProfile {
  testObjectLabels: string[];
  testObjectPattern: "snake_prefix" | "camelCase" | "PascalCase" | "mixed" | "unknown";
  testObjectPrefixExamples: string[];
  methodNaming: "camelCase" | "snake_case" | "mixed";
  classNaming: "PascalCase" | "mixed";
  keywordClassExamples: string[];
}

export interface AssertionStyleProfile {
  webUiVerifyCalls: string[];
  customVerifyKeywords: string[];
  prefersSoftAssertions: boolean;
  dominantPattern: "webui_verify" | "custom_keyword" | "mixed";
}

export interface LocatorStrategyProfile {
  findTestObjectRatio: number;
  inlineTestObjectRatio: number;
  preferredSelectorTypes: string[];
  dominantStrategy: "object_repository" | "inline_testobject" | "mixed";
  orPathExamples: string[];
}

export interface WaitStrategyProfile {
  webUiWaitCalls: Record<string, number>;
  customWaitKeywords: string[];
  dominantPattern: "webui_wait" | "custom_wait" | "mixed";
  defaultWaitSeconds?: number;
}

export interface FrameworkArchitectureProfile {
  hasBaseTestPattern: boolean;
  baseClassHints: string[];
  utilityClassHints: string[];
  pageObjectHints: string[];
  keywordDrivenScore: number;
  includeScriptCount: number;
}

export interface KeywordUsageProfile {
  path: string;
  callCount: number;
  methodNames: string[];
}

export interface FlowCluster {
  flowId: string;
  name: string;
  occurrenceCount: number;
  suggestedKeyword?: string;
  relatedOrPaths: string[];
  relatedKeywords: string[];
  stepPattern: string[];
}

export interface AntiPatternHint {
  kind: "duplicate_wait" | "duplicate_retry" | "raw_webui_over_keyword";
  message: string;
  severity: "info" | "warning";
}

export interface StyleEmbeddingFingerprint {
  /** Term → weight for similarity search */
  terms: Record<string, number>;
  scriptCount: number;
}

export interface ProjectMemoryProfile {
  projectId: string;
  projectName: string;
  builtAt: string;
  version: number;
  naming: NamingConventionProfile;
  assertions: AssertionStyleProfile;
  locators: LocatorStrategyProfile;
  waits: WaitStrategyProfile;
  architecture: FrameworkArchitectureProfile;
  topKeywords: KeywordUsageProfile[];
  reusableFlows: FlowCluster[];
  antiPatterns: AntiPatternHint[];
  codingStyleSummary: string[];
  promptInjectionBlock: string;
  embedding: StyleEmbeddingFingerprint;
  confidence: number;
}

export interface GenerationStyleContext {
  profile: ProjectMemoryProfile;
  similarScripts: { logicalPath: string; score: number; summary: string }[];
  injectionText: string;
  styleMatchHints: string[];
}

export interface StyleMatchReport {
  styleMatchScore: number;
  reusedHelpers: string[];
  matchedPatterns: string[];
  matchedArchitecture: string[];
}
