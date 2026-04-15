/**
 * Canonical representation of a single recorded user interaction (any tool → Katalon).
 */

export type UniversalRecordSource =
  | "playwright"
  | "selenium"
  | "appium"
  | "chrome-devtools"
  | "manual";

export type RecordPlatform = "web" | "mobile" | "unknown";

/** Normalized action vocabulary (sources may use different verbs). */
export type UniversalRecordAction =
  | "navigate"
  | "click"
  | "type"
  | "fill"
  | "press"
  | "scroll"
  | "wait"
  /** Unmapped command — preserved with needsReview; never dropped. */
  | "unknown";

export type RecordConfidence = "high" | "medium" | "low";

export interface UniversalRecordStep {
  sequence: number;
  action: UniversalRecordAction;
  /** Semantic target key (matches locator label / DSL target hint). */
  target?: string;
  value?: string;
  /** Original selector string from the recorder (ground truth). */
  selector?: string;
  source: UniversalRecordSource;
  /** Inferred from input format (e.g. Playwright → web). */
  platform?: RecordPlatform;
  timestamp?: number;
  confidence: RecordConfidence;
  /** When parsing was ambiguous — still emit the step. */
  needsReview?: boolean;
  /** JSON/interop alias for `needsReview` (set together when round-tripping). */
  needs_review?: boolean;
  raw?: string;
}

/** Loose interchange shape (docs / external integrators) — map from {@link UniversalRecordStep}. */
export type UniversalNormalizedStep = {
  action: string;
  target?: string;
  value?: string;
  selector?: string;
  source: string;
  platform: RecordPlatform;
  timestamp?: number;
  needs_review?: boolean;
  confidence?: RecordConfidence;
};

export function toUniversalNormalizedStep(s: UniversalRecordStep): UniversalNormalizedStep {
  return {
    action: s.action,
    target: s.target,
    value: s.value,
    selector: s.selector,
    source: s.source,
    platform: s.platform ?? "unknown",
    timestamp: s.timestamp,
    needs_review: s.needsReview === true ? true : s.needs_review,
    confidence: s.confidence,
  };
}

export interface UniversalParseResult {
  steps: UniversalRecordStep[];
  warnings: string[];
  errors: string[];
}
