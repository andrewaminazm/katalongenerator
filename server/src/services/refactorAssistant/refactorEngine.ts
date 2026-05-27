import { loadProjectIndex } from "../projectIntelligence/index.js";
import { buildProjectGraphV2 } from "../projectIntelligenceV2/projectGraphV2.js";
import { loadScriptContents } from "../projectIntelligenceV2/sourceLoader.js";
import { analyzeAssertionQuality } from "./assertionAnalyzer.js";
import { indexFingerprint, loadCachedRefactor, saveCachedRefactor } from "./cache.js";
import { analyzeDuplication } from "./duplicationAnalyzer.js";
import { buildArchitectureInsights } from "./frameworkArchitectureAnalyzer.js";
import { analyzeKeywordRefactoring } from "./keywordRefactorAnalyzer.js";
import { analyzeOrRefactoring } from "./orRefactorAnalyzer.js";
import { analyzeProjectStructure } from "./projectStructureAnalyzer.js";
import {
  buildRecommendations,
  computeFrameworkHealthScore,
  computeMaintainabilityScore,
} from "./recommendationEngine.js";
import { analyzeWaits } from "./waitAnalyzer.js";
import type { RefactorAnalysisResult, RefactorAnalyzeOptions, RefactorIssue } from "./types.js";

export async function runRefactorAnalysis(
  options: RefactorAnalyzeOptions
): Promise<RefactorAnalysisResult> {
  const index = await loadProjectIndex(options.projectId);
  if (!index) throw new Error("Project not found");

  const fingerprint = indexFingerprint(index);
  if (!options.forceRefresh) {
    const cached = await loadCachedRefactor(options.projectId, fingerprint);
    if (cached) return cached;
  }

  const graph = buildProjectGraphV2(index);
  const scripts = await loadScriptContents(
    options.projectId,
    index,
    options.maxScripts ?? 150
  );

  const allIssues: RefactorIssue[] = [];

  const dup = analyzeDuplication(index, graph);
  const assertion = analyzeAssertionQuality(scripts);
  const waits = analyzeWaits(scripts);
  const or = analyzeOrRefactoring(index, graph);
  const kw = analyzeKeywordRefactoring(index, graph);
  const structure = analyzeProjectStructure(index, scripts);
  const archInsights = buildArchitectureInsights(index);

  allIssues.push(
    ...dup.issues,
    ...assertion.issues,
    ...waits.issues,
    ...or.issues,
    ...kw.issues,
    ...structure.issues
  );

  const maintainabilityScore = computeMaintainabilityScore({
    duplicationScore: dup.duplicationScore,
    assertionQualityScore: assertion.qualityScore,
    orHealthScore: or.orHealthScore,
    waitStabilityScore: waits.stabilityScore,
    modularityScore: kw.modularityScore,
    complexityScore: structure.complexityScore,
  });

  const recommendations = buildRecommendations(allIssues);

  const result: RefactorAnalysisResult = {
    projectId: options.projectId,
    projectName: index.projectName,
    analyzedAt: new Date().toISOString(),
    fromCache: false,
    maintainabilityScore,
    duplicationScore: dup.duplicationScore,
    frameworkHealthScore: computeFrameworkHealthScore(maintainabilityScore, allIssues.length),
    assertionQualityScore: assertion.qualityScore,
    frameworkComplexityScore: structure.complexityScore,
    orHealthScore: or.orHealthScore,
    waitStabilityScore: waits.stabilityScore,
    issues: allIssues.slice(0, 80),
    recommendations,
    duplicateFlows: dup.duplicateFlows,
    weakAssertions: assertion.weakAssertions,
    orProblems: or.orProblems.slice(0, 40),
    keywordProblems: kw.keywordProblems.slice(0, 30),
    architectureInsights: [...archInsights, ...structure.insights],
    duplicationHeatmap: dup.heatmap,
  };

  await saveCachedRefactor(result, fingerprint);
  return result;
}
