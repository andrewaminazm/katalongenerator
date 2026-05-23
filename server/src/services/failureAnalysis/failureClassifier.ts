import type { FailureType } from "./types.js";
import type { ParsedStacktrace } from "./stacktraceParser.js";

export interface ClassificationSignal {
  failureType: FailureType;
  weight: number;
  reason: string;
}

export function classifyFailureSignals(
  corpus: string,
  parsed?: ParsedStacktrace | null
): ClassificationSignal[] {
  const c = corpus.toLowerCase();
  const signals: ClassificationSignal[] = [];

  const add = (failureType: FailureType, weight: number, reason: string) => {
    signals.push({ failureType, weight, reason });
  };

  if (
    /nosuchelement|staleelement|elementnotfound|invalid selector|xpath|css selector|findtestobject|object repository|test object|locator|not visible|strict mode|unable to click|unable to find/i.test(
      c
    )
  ) {
    add("LOCATOR", /findtestobject|object repository|test object|unable to click/i.test(c) ? 1 : 0.9, "Katalon test object / locator failure");
  }
  if (
    /timeout|timed out|waiting|wait.*failed|slow|race|async|animation|webui\.delay|waitforelement|smart wait/i.test(
      c
    )
  ) {
    add("TIMING", 0.75, "Katalon wait / timing failure");
  }
  if (
    /\b(500|502|503|504)\b|http\s*\d{3}|api\s*error|rest\s*error|unauthorized|401|403|invalid\s*payload|schema|contract/i.test(
      c
    )
  ) {
    add("API", 0.85, "HTTP/API failure detected");
  }
  if (
    /assertion|expected.*but|verifyequal|verifymatch|verifyelement|webui\.verify|should\s+equal|assert\s+failed|failurehandling/i.test(
      c
    )
  ) {
    add("ASSERTION", 0.8, "Katalon verification / assertion mismatch");
  }
  if (
    /connection refused|econnrefused|enotfound|network|dns|vpn|proxy|server\s*down|database|db\s*unavailable|environment/i.test(
      c
    )
  ) {
    add("ENVIRONMENT", 0.8, "Environment or infrastructure issue");
  }
  if (/invalid user|expired token|test data|no\s*data|credential|login failed|auth/i.test(c)) {
    add("TEST_DATA", 0.7, "Test data or authentication data issue");
  }
  if (
    /nullpointer|compilation|classpath|dependency|test listener|keyword definition|stepfailedexception.*groovy/i.test(
      c
    )
  ) {
    add("FRAMEWORK", 0.8, "Katalon keyword / Groovy script error");
  }
  if (/customkeywords\.'[^']+'|keyword.*\.groovy:\d+/i.test(c) && !/findtestobject|nosuchelement|unable to click/i.test(c)) {
    add("FRAMEWORK", 0.7, "Custom Keyword execution error");
  }
  if (
    /browser\s*crash|session\s*expired|webdriver|chromedriver|disconnected|appium.*disconnect|instrumentation/i.test(
      c
    )
  ) {
    add("BROWSER_AUTOMATION", 0.75, "Browser or driver session issue");
  }

  if (parsed) {
    const ex = parsed.exceptionType.toLowerCase();
    if (/nosuchelement|staleelement|notfound/.test(ex)) add("LOCATOR", 0.95, `Exception: ${parsed.exceptionType}`);
    if (/timeout/.test(ex)) add("TIMING", 0.9, `Exception: ${parsed.exceptionType}`);
    if (/assertion/.test(ex)) add("ASSERTION", 0.9, `Exception: ${parsed.exceptionType}`);
  }

  return signals;
}

export function pickPrimaryFailureType(signals: ClassificationSignal[]): FailureType {
  if (!signals.length) return "UNKNOWN";
  const scores = new Map<FailureType, number>();
  for (const s of signals) {
    scores.set(s.failureType, (scores.get(s.failureType) ?? 0) + s.weight);
  }
  let best: FailureType = "UNKNOWN";
  let bestScore = 0;
  for (const [type, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      best = type;
    }
  }
  return best;
}
