import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectMemoryProfile } from "./types.js";
import { analyzeNamingConventions } from "./namingConventionAnalyzer.js";
import { analyzeAssertionPatterns } from "./assertionPatternAnalyzer.js";
import { analyzeLocatorStrategy } from "./locatorStrategyAnalyzer.js";
import { analyzeFrameworkArchitecture } from "./frameworkArchitectureAnalyzer.js";
import { extractFlowClusters } from "./reusableFlowExtractor.js";
import {
  analyzeWaitStrategy,
  buildKeywordUsageProfile,
  detectAntiPatterns,
} from "./codingStyleProfiler.js";
import { buildStyleEmbedding } from "./styleEmbeddingEngine.js";
import { buildPromptInjectionBlock } from "./generationContextBuilder.js";

/**
 * Full scan of an indexed project → persistent memory profile.
 */
export function scanProjectPatterns(index: ProjectIndex): ProjectMemoryProfile {
  const testScripts = index.testScripts ?? index.testCases ?? [];
  const naming = analyzeNamingConventions(index.testObjects, index.keywords);
  const assertions = analyzeAssertionPatterns(testScripts);
  const locators = analyzeLocatorStrategy(index.testObjects, testScripts);
  const waits = analyzeWaitStrategy(testScripts, index.keywords);
  const architecture = analyzeFrameworkArchitecture(index.keywords, testScripts);
  const topKeywords = buildKeywordUsageProfile(testScripts, index.keywords);
  const reusableFlows = extractFlowClusters(index.reusableFlows, testScripts);
  const antiPatterns = detectAntiPatterns(testScripts, architecture.keywordDrivenScore);

  const codingStyleSummary: string[] = [
    ...index.codingStyleHints,
    `Locator strategy: ${locators.dominantStrategy}`,
    `Wait strategy: ${waits.dominantPattern}`,
    `Assertion style: ${assertions.dominantPattern}`,
    `Keyword-driven score: ${(architecture.keywordDrivenScore * 100).toFixed(0)}%`,
  ];

  if (naming.testObjectPattern === "snake_prefix") {
    codingStyleSummary.push(`OR labels use prefixes: ${naming.testObjectPrefixExamples.join(", ")}`);
  }

  const draft: ProjectMemoryProfile = {
    projectId: index.projectId,
    projectName: index.projectName,
    builtAt: new Date().toISOString(),
    version: 1,
    naming,
    assertions,
    locators,
    waits,
    architecture,
    topKeywords,
    reusableFlows,
    antiPatterns,
    codingStyleSummary,
    promptInjectionBlock: "",
    embedding: buildStyleEmbedding(testScripts),
    confidence: computeProfileConfidence(index, testScripts.length),
  };

  draft.promptInjectionBlock = buildPromptInjectionBlock(draft);
  return draft;
}

function computeProfileConfidence(index: ProjectIndex, scriptCount: number): number {
  let score = 0.3;
  if (scriptCount >= 5) score += 0.2;
  if (scriptCount >= 20) score += 0.15;
  if (index.keywords.length >= 3) score += 0.15;
  if (index.testObjects.length >= 10) score += 0.1;
  if (index.reusableFlows.length > 0) score += 0.1;
  return Math.min(1, score);
}
