/** Locator strategy for Katalon addProperty — one per TestObject. */
export type LocatorKind =
  | "id"
  | "name"
  | "css"
  | "xpath"
  | "accessibilityId"
  | "resourceId"
  /** Object Repository path — use findTestObject, not inline TestObject */
  | "orPath";

export interface ParsedLocatorLine {
  label: string;
  rhs: string;
  rawLine: string;
}

/** Single winning locator after scoring. */
export interface ResolvedLocator {
  label: string;
  /** ASCII variable base, e.g. searchBox */
  varBase: string;
  kind: LocatorKind;
  /** First argument to addProperty */
  propertyName: string;
  value: string;
  score: number;
  /** When kind === orPath */
  orPath?: string;
  /** Secondary locator strategies (id > name > css > xpath) for the same TestObject. */
  fallbackProperties?: { propertyName: string; value: string }[];
  /** Built from recorded selector when no OR / fuzzy match — emit // Fallback in Groovy. */
  recordingFallback?: boolean;
}

export type StepIntent =
  | { kind: "openBrowser"; url?: string }
  | { kind: "navigate"; url: string }
  | { kind: "maximize" }
  | { kind: "click"; targetHint: string }
  | { kind: "check"; targetHint: string }
  | { kind: "uncheck"; targetHint: string }
  | { kind: "setText"; targetHint: string; text: string }
  | { kind: "pressEnter" }
  | { kind: "sendKey"; key: string; targetHint: string }
  | { kind: "verifyTextPresent"; text: string; caseSensitive?: boolean }
  | { kind: "verifyElementVisible"; targetHint: string }
  | { kind: "closeBrowser" }
  | { kind: "waitPage"; seconds: number }
  | { kind: "startApplication"; path: string }
  | { kind: "tap"; targetHint: string }
  | { kind: "mobileSetText"; targetHint: string; text: string }
  | { kind: "swipe" }
  | { kind: "unknown"; raw: string };

export interface CompileKatalonInput {
  platform: "web" | "mobile";
  steps: string[];
  /** Merged user + auto-detect locator lines */
  locatorsText: string;
  /** Default URL for open/navigation when steps omit explicit URL */
  url?: string;
  testCaseName?: string;
  /**
   * TestObject label → raw selector from recording (Playwright DSL). Used when OR/fuzzy match fails
   * to build inline TestObjects — never skips the step.
   */
  selectorByTestObjectLabel?: Record<string, string>;
  /**
   * When set, same order as `steps` and same length as compiler intents: raw Playwright `context.selector`
   * per step. Used if label-based lookup fails (Unicode / label drift).
   */
  playwrightContextSelectors?: (string | undefined)[];
}

export interface CompileKatalonResult {
  code: string;
  model: string;
  warnings: string[];
  validationErrors: string[];
  /** When validation fails: compile = locator/step resolution; groovy = post-gen keyword gate. */
  validationStage?: "compile" | "groovy";
}
