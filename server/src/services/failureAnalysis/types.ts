/** Classified failure category for automation runs. */
export type FailureType =
  | "LOCATOR"
  | "TIMING"
  | "API"
  | "ASSERTION"
  | "ENVIRONMENT"
  | "TEST_DATA"
  | "FRAMEWORK"
  | "BROWSER_AUTOMATION"
  | "UNKNOWN";

export type AffectedLayer =
  | "ui"
  | "api"
  | "data"
  | "infrastructure"
  | "framework"
  | "test"
  | "unknown";

export type FlakyLevel = "low" | "medium" | "high" | "unknown";

export type Severity = "low" | "medium" | "high" | "critical";

export interface ExecutionMetadata {
  testName?: string;
  suiteName?: string;
  browser?: string;
  platform?: "web" | "mobile" | "api";
  durationMs?: number;
  retryCount?: number;
  failedStep?: string;
  url?: string;
  timestamp?: string;
}

export interface FailureAnalysisRequest {
  logs?: string;
  stacktrace?: string;
  consoleLogs?: string;
  screenshot?: string;
  screenshotDescription?: string;
  apiResponse?: string;
  harLog?: string;
  katalonReport?: string;
  /** Katalon Mobile / Appium session log (not standalone Playwright). */
  appiumLog?: string;
  projectId?: string;
  executionMetadata?: ExecutionMetadata;
  authorizationToken?: string;
  model?: string;
}

export interface TimelineEvent {
  id: string;
  label: string;
  timestampMs?: number;
  kind: "step" | "wait" | "failure" | "retry" | "api" | "navigation";
  detail?: string;
}

export interface SuggestedFix {
  id: string;
  title: string;
  description: string;
  codeExample?: string;
  priority: "high" | "medium" | "low";
  category: FailureType | "architecture" | "healing";
}

export interface HealingSuggestion {
  endpoint: string;
  description: string;
  payloadHint?: Record<string, unknown>;
}

export interface RelatedPattern {
  id: string;
  signature: string;
  occurrences: number;
  lastSeen: string;
  flakyRate?: number;
}

export interface DetectedPatternSummary {
  pattern: string;
  inference: string;
  failureType: FailureType;
  confidence: number;
}

export interface ExecutionLogInsights {
  failedTestObject?: string;
  failedKeyword?: string;
  failingStepMessage?: string;
  platform: string;
  timingSummary: string;
  retryAttempts: number;
  parseConfidence: number;
  warnings: string[];
}

export interface PlainEnglishReport {
  headline: string;
  whatHappened: string;
  likelyReason: string;
  stepsToTry: string[];
  errorSnippet?: string;
  testName?: string;
}

import type { ReliabilityIntelligence } from "../reliabilityIntelligence/types.js";

export interface FailureAnalysisResult {
  plainEnglish?: PlainEnglishReport;
  rootCause: string;
  rootCauseSummary: string;
  failureType: FailureType;
  flakyProbability: number;
  flakyLevel: FlakyLevel;
  /** @deprecated Use rootCauseConfidence */
  confidence: number;
  rootCauseConfidence: number;
  suggestedFixConfidence: number;
  logOnlyMode: boolean;
  detectedPatterns: DetectedPatternSummary[];
  executionLogInsights?: ExecutionLogInsights;
  confidenceNotes?: string;
  affectedLayer: AffectedLayer;
  severity: Severity;
  reproducibility: "likely" | "intermittent" | "unknown";
  secondaryFactors: string[];
  suggestedFixes: SuggestedFix[];
  recommendedArchitectureImprovements: string[];
  relatedPatterns: RelatedPattern[];
  healingSuggestions: HealingSuggestion[];
  timeline: TimelineEvent[];
  locatorInsights?: {
    problem: string;
    recommendation: string;
    isDynamic: boolean;
    domChangeLikely: boolean;
  };
  timingInsights?: {
    problem: string;
    recommendation: string;
    raceConditionLikely: boolean;
  };
  apiInsights?: {
    problem: string;
    recommendation: string;
    statusCode?: number;
    authIssue: boolean;
  };
  screenshotInsights?: string[];
  architectureInsights: string[];
  projectContext?: {
    matchedKeyword?: string;
    matchedOrPath?: string;
    sourceFileHint?: string;
  };
  aiEnhanced: boolean;
  uncertainty?: string;
  analyzedAt: string;
  /** Enterprise reliability intelligence (additive) */
  reliability?: ReliabilityIntelligence;
}

export interface FailureHistoryEntry {
  id: string;
  analyzedAt: string;
  failureType: FailureType;
  rootCauseSummary: string;
  confidence: number;
  flakyProbability: number;
  signature: string;
  projectId?: string;
}

export interface FailurePatternSummary {
  signature: string;
  failureType: FailureType;
  count: number;
  avgFlakyProbability: number;
  lastSeen: string;
  hotspot: boolean;
}
