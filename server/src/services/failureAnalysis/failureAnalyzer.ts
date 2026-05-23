import { mergeTextSignals, parseStacktrace } from "./stacktraceParser.js";
import { classifyFailureSignals, pickPrimaryFailureType } from "./failureClassifier.js";
import { analyzeLocatorFailure } from "./locatorFailureAnalyzer.js";
import { analyzeTimingIssue } from "./timingIssueAnalyzer.js";
import { analyzeApiFailure } from "./apiFailureAnalyzer.js";
import { analyzeConsoleLogs } from "./consoleLogAnalyzer.js";
import { detectEnvironmentIssues } from "./environmentIssueDetector.js";
import { inspectScreenshotContext } from "./screenshotInspector.js";
import { detectFlakiness } from "./flakyDetector.js";
import { scoreConfidence } from "./confidenceScorer.js";
import { buildRootCause } from "./rootCauseEngine.js";
import {
  buildArchitectureInsights,
  buildHealingSuggestions,
  buildSuggestedFixes,
} from "./fixRecommendationEngine.js";
import { enhanceWithAiReasoning } from "./aiReasoningEngine.js";
import {
  findRelatedPatterns,
  recordFailureAnalysis,
} from "./failurePatternMemory.js";
import {
  analyzeKatalonExecutionLog,
  combineKatalonLogSources,
} from "./katalonExecutionLogAnalyzer.js";
import { inferFromKatalonLogs } from "./logInferenceEngine.js";
import {
  buildPlainEnglishReport,
  filterSecondaryFactorsForDisplay,
} from "./plainEnglishReport.js";
import type {
  FailureAnalysisRequest,
  FailureAnalysisResult,
  RelatedPattern,
  DetectedPatternSummary,
} from "./types.js";
import { loadProjectIndex } from "../projectIntelligence/projectStore.js";
import { buildMemoryContextForGeneration, resolveAiMemoryMode } from "../aiMemory/index.js";

async function memoryHintsForProject(projectId?: string): Promise<string[]> {
  if (!projectId) return [];
  try {
    const index = await loadProjectIndex(projectId);
    if (!index) return [];
    const ctx = await buildMemoryContextForGeneration(
      projectId,
      [],
      index,
      resolveAiMemoryMode("learn_suggest")
    );
    if (!ctx?.injectionText) return [];
    const hints: string[] = [];
    if (/WaitHelper|waitVisible/i.test(ctx.injectionText)) {
      hints.push("Replace WebUI.delay() with WaitHelper.waitVisible() per project convention.");
    }
    if (/CustomKeywords/i.test(ctx.injectionText)) {
      hints.push("Reuse existing Custom Keywords from this project when fixing failures.");
    }
    return hints;
  } catch {
    return [];
  }
}

function resolveProjectContext(
  corpus: string,
  projectId?: string
): Promise<FailureAnalysisResult["projectContext"]> {
  return (async () => {
    if (!projectId) return undefined;
    try {
      const index = await loadProjectIndex(projectId);
      if (!index) return undefined;
      const kwMatch = index.keywords.find(
        (kw) => corpus.includes(kw.className) || corpus.includes(kw.customKeywordsPath)
      );
      const orMatch = index.testObjects.find(
        (o) => corpus.includes(o.label) || corpus.includes(o.path)
      );
      return {
        matchedKeyword: kwMatch ? `${kwMatch.customKeywordsPath}` : undefined,
        matchedOrPath: orMatch?.path,
        sourceFileHint: orMatch?.sourceFile,
      };
    } catch {
      return undefined;
    }
  })();
}

function hasSupplementaryEvidence(request: FailureAnalysisRequest): boolean {
  return Boolean(
    request.stacktrace?.trim() ||
      request.consoleLogs?.trim() ||
      request.apiResponse?.trim() ||
      request.screenshot?.trim() ||
      request.screenshotDescription?.trim() ||
      request.harLog?.trim()
  );
}

export async function analyzeFailure(
  request: FailureAnalysisRequest
): Promise<FailureAnalysisResult> {
  const katalonLogText = combineKatalonLogSources({
    logs: request.logs,
    katalonReport: request.katalonReport,
    appiumLog: request.appiumLog,
    stacktrace: request.stacktrace,
  });

  const logOnlyMode =
    Boolean(katalonLogText.trim()) && !hasSupplementaryEvidence(request);

  const logAnalysis = katalonLogText.trim()
    ? analyzeKatalonExecutionLog(katalonLogText)
    : null;

  const logInference = logAnalysis ? inferFromKatalonLogs(logAnalysis) : null;

  const corpus = mergeTextSignals(
    logAnalysis?.syntheticCorpus,
    request.logs,
    request.stacktrace,
    request.consoleLogs,
    request.apiResponse,
    request.harLog,
    request.katalonReport,
    request.appiumLog
  );

  const parsed = request.stacktrace
    ? parseStacktrace(request.stacktrace)
    : logAnalysis?.exceptionMessage
      ? parseStacktrace(logAnalysis.exceptionMessage)
      : null;

  const corpusSignals = classifyFailureSignals(corpus, parsed);
  const mergedSignals = [
    ...corpusSignals,
    ...(logAnalysis?.classificationSignals ?? []),
  ];
  const failureType =
    logInference && logInference.failureType !== "UNKNOWN"
      ? logInference.failureType
      : pickPrimaryFailureType(mergedSignals);

  const locator = analyzeLocatorFailure(corpus);
  const timing = analyzeTimingIssue(corpus);
  const api = analyzeApiFailure(corpus);
  const environment = detectEnvironmentIssues(corpus);
  const consoleAnalysis = request.consoleLogs
    ? analyzeConsoleLogs(request.consoleLogs)
    : { browserErrors: [], networkErrors: [], jsErrors: [], score: 0 };
  const screenshot = inspectScreenshotContext(request.screenshotDescription, corpus);

  const flakyFromLog = logAnalysis?.timing.flakyTimingLikely ?? false;
  const flaky = detectFlakiness(corpus, timing, locator, {
    ...request.executionMetadata,
    retryCount:
      (request.executionMetadata?.retryCount ?? 0) +
      (logAnalysis?.timing.retryAttempts ?? 0),
  });
  if (flakyFromLog && flaky.probability < 0.5) {
    flaky.probability = Math.min(1, flaky.probability + 0.25);
    flaky.indicators.push("Repeated waits/timeouts in Katalon execution log");
    if (flaky.probability >= 0.65) flaky.level = "high";
    else if (flaky.probability >= 0.35) flaky.level = "medium";
  }

  const root = buildRootCause({
    failureType,
    signals: mergedSignals,
    parsed,
    locator,
    timing,
    api,
    environment,
    flakyIndicators: flaky.indicators,
  });

  const memoryHints = await memoryHintsForProject(request.projectId);
  const projectContext = await resolveProjectContext(corpus, request.projectId);

  const signalAgreement =
    mergedSignals.filter((s) => s.failureType === failureType).length /
    Math.max(1, mergedSignals.length);

  const { rootCauseConfidence, suggestedFixConfidence, notes } = scoreConfidence({
    hasStacktrace: Boolean(request.stacktrace?.trim() || logAnalysis?.exceptionMessage),
    hasLogs: Boolean(katalonLogText.trim()),
    hasConsole: Boolean(request.consoleLogs?.trim()),
    hasApi: Boolean(request.apiResponse?.trim()),
    hasScreenshot: Boolean(
      request.screenshot?.trim() || request.screenshotDescription?.trim()
    ),
    analyzerScores: [
      locator.score,
      timing.score,
      api.score,
      environment.score,
      consoleAnalysis.score,
      screenshot.score,
      logAnalysis?.parseConfidence ?? 0,
    ],
    signalAgreement,
    aiEnhanced: false,
    logOnlyMode,
    katalonParseConfidence: logAnalysis?.parseConfidence,
    inferenceConfidence: logInference?.inferenceConfidence,
    patternCount: logAnalysis?.patterns.length,
  });

  const suggestedFixes = buildSuggestedFixes({
    failureType,
    locator,
    timing,
    api,
    parsed,
    memoryHints,
    corpus,
  });

  const detectedPatterns: DetectedPatternSummary[] =
    logAnalysis?.patterns.map((p) => ({
      pattern: p.pattern,
      inference: p.inference,
      failureType: p.failureType,
      confidence: p.confidence,
    })) ?? [];

  let rootCause = logInference?.rootCause ?? root.rootCause;
  let rootCauseSummary = logInference?.rootCauseSummary ?? root.rootCauseSummary;
  const secondaryFactors = [
    ...(logInference?.secondaryFactors ?? []),
    ...root.secondaryFactors,
  ].filter((v, i, a) => a.indexOf(v) === i);

  const analyzedAt = new Date().toISOString();

  const executionLogInsights = logAnalysis
    ? {
        failedTestObject: logAnalysis.failedTestObject,
        failedKeyword: logAnalysis.failedKeyword,
        failingStepMessage: logAnalysis.failingStep?.message,
        platform: logAnalysis.platform,
        timingSummary: logAnalysis.timing.summary,
        retryAttempts: logAnalysis.timing.retryAttempts,
        parseConfidence: logAnalysis.parseConfidence,
        warnings: logAnalysis.warnings,
      }
    : undefined;

  let draft: FailureAnalysisResult = {
    rootCause,
    rootCauseSummary,
    failureType,
    flakyProbability: flaky.probability,
    flakyLevel: flaky.level,
    confidence: rootCauseConfidence,
    rootCauseConfidence,
    suggestedFixConfidence,
    logOnlyMode,
    detectedPatterns,
    executionLogInsights,
    confidenceNotes: notes.join(" "),
    affectedLayer: root.affectedLayer,
    severity: root.severity,
    reproducibility: flakyFromLog ? "intermittent" : root.reproducibility,
    secondaryFactors: secondaryFactors.slice(0, 10),
    suggestedFixes,
    recommendedArchitectureImprovements: buildArchitectureInsights(corpus, memoryHints),
    relatedPatterns: [],
    healingSuggestions: buildHealingSuggestions(locator),
    timeline: logAnalysis?.timeline.length ? logAnalysis.timeline : [],
    locatorInsights: locator.detected
      ? {
          problem: locator.problem,
          recommendation: locator.recommendation,
          isDynamic: locator.isDynamic,
          domChangeLikely: locator.domChangeLikely,
        }
      : undefined,
    timingInsights: timing.detected || logAnalysis?.timing.repeatedTimeouts
      ? {
          problem: logAnalysis?.timing.summary ?? timing.problem,
          recommendation: timing.recommendation,
          raceConditionLikely:
            timing.raceConditionLikely || Boolean(logAnalysis?.timing.flakyTimingLikely),
        }
      : undefined,
    apiInsights: api.detected
      ? {
          problem: api.problem,
          recommendation: api.recommendation,
          statusCode: api.statusCode,
          authIssue: api.authIssue,
        }
      : undefined,
    screenshotInsights: screenshot.insights.length ? screenshot.insights : undefined,
    architectureInsights: buildArchitectureInsights(corpus, memoryHints),
    projectContext,
    aiEnhanced: false,
    analyzedAt,
  };

  draft.secondaryFactors = filterSecondaryFactorsForDisplay(draft.secondaryFactors);

  const evidenceBundle = corpus.slice(0, 14000);
  const aiPatch = await enhanceWithAiReasoning(draft, evidenceBundle, {
    authorizationToken: request.authorizationToken,
    model: request.model,
  });
  draft = {
    ...draft,
    ...aiPatch,
    rootCauseConfidence: aiPatch.aiEnhanced
      ? Math.min(0.98, draft.rootCauseConfidence + 0.05)
      : draft.rootCauseConfidence,
    confidence: aiPatch.aiEnhanced
      ? Math.min(0.98, draft.rootCauseConfidence + 0.05)
      : draft.rootCauseConfidence,
  };

  if (/unable to get the url of the current window/i.test(corpus) && draft.suggestedFixes.length < 2) {
    draft.suggestedFixes = buildSuggestedFixes({
      failureType: "BROWSER_AUTOMATION",
      locator,
      timing,
      api,
      parsed,
      memoryHints,
      corpus,
    });
  }

  draft.plainEnglish = buildPlainEnglishReport(
    draft,
    corpus,
    logAnalysis,
    request.executionMetadata
  );

  const signature = `${draft.failureType}:${draft.rootCauseSummary}`.toLowerCase().slice(0, 120);
  const patterns = await findRelatedPatterns(signature, draft.failureType);
  draft.relatedPatterns = patterns.map(
    (p): RelatedPattern => ({
      id: p.signature,
      signature: p.signature,
      occurrences: p.count,
      lastSeen: p.lastSeen,
      flakyRate: p.avgFlakyProbability,
    })
  );

  await recordFailureAnalysis(draft, request.projectId);
  return draft;
}
