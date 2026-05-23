import type { FailureType, AffectedLayer, Severity } from "./types.js";
import type { ClassificationSignal } from "./failureClassifier.js";
import type { LocatorAnalysis } from "./locatorFailureAnalyzer.js";
import type { TimingAnalysis } from "./timingIssueAnalyzer.js";
import type { ApiAnalysis } from "./apiFailureAnalyzer.js";
import type { EnvironmentAnalysis } from "./environmentIssueDetector.js";
import type { ParsedStacktrace } from "./stacktraceParser.js";

export interface RootCauseResult {
  rootCause: string;
  rootCauseSummary: string;
  secondaryFactors: string[];
  affectedLayer: AffectedLayer;
  severity: Severity;
  reproducibility: "likely" | "intermittent" | "unknown";
}

function layerForType(type: FailureType): AffectedLayer {
  switch (type) {
    case "API":
      return "api";
    case "ENVIRONMENT":
      return "infrastructure";
    case "TEST_DATA":
      return "data";
    case "FRAMEWORK":
      return "framework";
    case "BROWSER_AUTOMATION":
      return "infrastructure";
    case "ASSERTION":
      return "test";
    default:
      return "ui";
  }
}

export function buildRootCause(params: {
  failureType: FailureType;
  signals: ClassificationSignal[];
  parsed?: ParsedStacktrace | null;
  locator: LocatorAnalysis;
  timing: TimingAnalysis;
  api: ApiAnalysis;
  environment: EnvironmentAnalysis;
  flakyIndicators: string[];
}): RootCauseResult {
  const secondaryFactors = [
    ...params.signals.slice(0, 4).map((s) => s.reason),
    ...params.flakyIndicators,
    ...params.environment.factors,
  ].filter((v, i, a) => a.indexOf(v) === i);

  let rootCause = "The test failed due to an undetermined automation error.";
  let rootCauseSummary = "Review stacktrace and execution logs.";

  switch (params.failureType) {
    case "LOCATOR":
      rootCause = params.locator.problem || "Locator could not resolve the target UI element.";
      rootCauseSummary = params.locator.recommendation;
      break;
    case "TIMING":
      rootCause = params.timing.problem || "Timing/wait strategy did not match application load behavior.";
      rootCauseSummary = params.timing.recommendation;
      break;
    case "API":
      rootCause = params.api.problem || "API layer failure during test execution.";
      rootCauseSummary = params.api.recommendation;
      break;
    case "ASSERTION":
      rootCause = "Test assertion did not match actual application state.";
      rootCauseSummary =
        "Verify expected values against environment data; check for delayed UI updates before assert.";
      break;
    case "ENVIRONMENT":
      rootCause = params.environment.problem || "Infrastructure or environment instability.";
      rootCauseSummary = "Validate server health, network, VPN, and test environment availability.";
      break;
    case "TEST_DATA":
      rootCause = "Test data or credentials appear invalid or expired.";
      rootCauseSummary = "Refresh test users, tokens, and data fixtures in profiles/GlobalVariable.";
      break;
    case "FRAMEWORK":
      rootCause = params.parsed?.message
        ? `Framework/script error: ${params.parsed.exceptionType} — ${params.parsed.message}`
        : "Framework keyword, helper, or Groovy script error.";
      rootCauseSummary = params.parsed?.groovyFile
        ? `Inspect ${params.parsed.groovyFile}${params.parsed.lineNumber ? `:${params.parsed.lineNumber}` : ""}`
        : "Review Custom Keywords and shared helpers referenced in the stacktrace.";
      break;
    case "BROWSER_AUTOMATION":
      rootCause = "Katalon browser or Mobile driver session failed during execution.";
      rootCauseSummary =
        "Restart the Katalon run; verify WebDriver/Appium settings in Katalon Studio and driver versions for the selected execution profile.";
      break;
    default:
      if (params.parsed) {
        rootCause = `${params.parsed.exceptionType}: ${params.parsed.message || "see stacktrace"}`;
      }
  }

  const affectedLayer = layerForType(params.failureType);
  let severity: Severity = "medium";
  if (params.failureType === "ENVIRONMENT" || params.api.statusCode && params.api.statusCode >= 500) {
    severity = "high";
  }
  if (params.failureType === "FRAMEWORK" && /nullpointer|compilation/i.test(params.parsed?.exceptionType ?? "")) {
    severity = "high";
  }

  const reproducibility: RootCauseResult["reproducibility"] =
    params.flakyIndicators.length >= 2 ? "intermittent" : params.failureType === "ENVIRONMENT" ? "intermittent" : "likely";

  return {
    rootCause,
    rootCauseSummary,
    secondaryFactors: secondaryFactors.slice(0, 8),
    affectedLayer,
    severity,
    reproducibility,
  };
}
