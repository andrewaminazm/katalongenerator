/** Structured failure from Katalon runtime, Playwright validation, or client. */
export type HealingErrorType = "NOT_FOUND" | "TIMEOUT" | "CLICK_INTERCEPTED" | "UNKNOWN";

export interface LocatorRef {
  type: string;
  value: string;
}

export interface FailureReport {
  stepId: string;
  action: string;
  failedLocator: LocatorRef;
  errorType: HealingErrorType;
  screenshot?: string;
  domSnapshot?: string;
}

export type HealingLocatorType =
  | "id"
  | "name"
  | "data-testid"
  | "accessibilityId"
  | "css"
  | "xpath";

export interface FallbackLocator {
  type: HealingLocatorType | string;
  value: string;
  score: number;
  source: "memory" | "rule" | "ai";
}

export interface LocatorHealingRequest {
  url: string;
  failure: FailureReport;
  /** Max rule/AI candidates to try (default 3). */
  maxRetries?: number;
  /** Skip AI even if rules fail (debug). */
  skipAi?: boolean;
  platform?: "web" | "mobile";
}

export interface HealingAttempt {
  locator: FallbackLocator;
  success: boolean;
  error?: string;
}

export interface LocatorHealingResult {
  success: boolean;
  winningLocator?: FallbackLocator;
  attempts: HealingAttempt[];
  ruleBasedCandidates: FallbackLocator[];
  aiUsed: boolean;
  aiCandidates: FallbackLocator[];
  warnings: string[];
  /** Updated TestObject-style line for Katalon: addProperty or findTestObject hint */
  suggestedKatalonSnippet?: string;
  memoryUpdated: boolean;
}

export interface HealingMemoryEntry {
  id: string;
  urlPattern: string;
  stepId: string;
  domSignature: string;
  locatorType: string;
  locatorValue: string;
  createdAt: string;
  lastHitAt: string;
  hitCount: number;
}
