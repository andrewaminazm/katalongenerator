import { loadProjectIndex } from "../projectIntelligence/index.js";
import { buildProjectGraphV2 } from "../projectIntelligenceV2/projectGraphV2.js";
import { loadScriptContents } from "../projectIntelligenceV2/sourceLoader.js";
import { analyzeAssertions } from "./assertionAnalyzer.js";
import { analyzeApiCoverage } from "./apiCoverageAnalyzer.js";
import { analyzeBusinessFlows } from "./businessFlowAnalyzer.js";
import { indexFingerprint, loadCachedCoverage, saveCachedCoverage } from "./cache.js";
import { analyzeKeywordCoverage } from "./keywordCoverageAnalyzer.js";
import { analyzeOrCoverage } from "./orCoverageAnalyzer.js";
import {
  analyzeScriptCoverage,
  inferModule,
} from "./scriptCoverageAnalyzer.js";
import {
  computeModuleScores,
  computeOverallCoverage,
  scoreToRiskLevel,
} from "./riskEngine.js";
import type {
  CoverageAnalysisResult,
  CoverageAnalyzeOptions,
  CoverageHeatmapCell,
  CoverageModuleScore,
  CoverageRecommendation,
} from "./types.js";

export async function runCoverageAnalysis(
  options: CoverageAnalyzeOptions
): Promise<CoverageAnalysisResult> {
  const index = await loadProjectIndex(options.projectId);
  if (!index) {
    throw new Error("Project not found");
  }

  const fingerprint = indexFingerprint(index);
  if (!options.forceRefresh) {
    const cached = await loadCachedCoverage(options.projectId, fingerprint);
    if (cached) return cached;
  }

  const graph = buildProjectGraphV2(index);
  const scripts = index.testScripts ?? index.testCases ?? [];
  const loadedScripts = await loadScriptContents(
    options.projectId,
    index,
    options.maxScripts ?? 150
  );

  const { findings: weakAssertions, averageAssertionRatio } =
    analyzeAssertions(loadedScripts);
  const or = analyzeOrCoverage(index, graph);
  const kw = analyzeKeywordCoverage(index, graph);
  const scriptCov = analyzeScriptCoverage(index, graph);
  const api = analyzeApiCoverage(index, options.swagger, options.postmanCollection);
  const business = analyzeBusinessFlows(scripts);

  const weakByModule = new Map<string, number>();
  for (const w of weakAssertions) {
    const mod = inferModule(w.logicalPath);
    weakByModule.set(mod, (weakByModule.get(mod) ?? 0) + 1);
  }

  const missingByModule = new Map<string, number>();
  for (const m of [...business.missing, ...api.missing]) {
    missingByModule.set(m.module, (missingByModule.get(m.module) ?? 0) + 1);
  }

  const modules: CoverageModuleScore[] = [];
  const moduleNames = new Set([
    ...scriptCov.scriptsByModule.keys(),
    ...business.flows.map((f) => f.name),
  ]);

  if (moduleNames.size === 0) moduleNames.add("General");

  for (const module of moduleNames) {
    const scriptCount = scriptCov.scriptsByModule.get(module)?.length ?? 0;
    const scores = computeModuleScores({
      module,
      scriptCount,
      weakAssertionCount: weakByModule.get(module) ?? 0,
      missingCount: missingByModule.get(module) ?? 0,
      avgAssertionRatio: averageAssertionRatio,
    });
    modules.push({
      module,
      coverageScore: scores.coverageScore,
      riskLevel: scores.riskLevel,
      assertionScore: scores.assertionScore,
      missingScenarios: business.missing
        .filter((m) => m.module === module)
        .map((m) => m.scenario)
        .slice(0, 8),
      recommendations: [],
      testScriptCount: scriptCount,
      orUsageScore: or.healthScore,
    });
  }

  modules.sort((a, b) => a.coverageScore - b.coverageScore);

  const recommendations: CoverageRecommendation[] = [
    ...or.recommendations,
    ...kw.recommendations,
    ...scriptCov.recommendations,
    ...api.recommendations,
  ];

  if (weakAssertions.length > 5) {
    recommendations.push({
      id: "assertion-light",
      severity: "high",
      category: "assertion",
      title: "Validation-light automation detected",
      detail: `${weakAssertions.length} script(s) are action-heavy with few verify/assert calls. Strengthen regression value with explicit validations.`,
      affectedItems: weakAssertions.slice(0, 8).map((w) => w.logicalPath),
    });
  }

  if (averageAssertionRatio < 0.2) {
    recommendations.push({
      id: "assertion-global",
      severity: "medium",
      category: "regression",
      title: "Low global assertion ratio",
      detail: "Consider a team standard: at least one verification per critical user action.",
    });
  }

  const overallCoverage = computeOverallCoverage(modules);
  const riskScore = Math.min(
    100,
    Math.round(
      100 - overallCoverage +
        or.unused.length * 0.5 +
        weakAssertions.length * 2 +
        (api.summary?.untestedEndpoints.length ?? 0) * 3
    )
  );
  const maintainabilityScore = Math.round((or.healthScore + kw.score) / 2);

  const heatmap: CoverageHeatmapCell[] = modules.map((m) => ({
    module: m.module,
    coverage: m.coverageScore,
    risk: 100 - m.coverageScore,
    assertionQuality: m.assertionScore,
  }));

  const unusedAssets = [...or.unused, ...kw.unused];

  const result: CoverageAnalysisResult = {
    projectId: options.projectId,
    projectName: index.projectName,
    analyzedAt: new Date().toISOString(),
    fromCache: false,
    overallCoverage,
    riskScore,
    maintainabilityScore,
    flakyIndicatorCount: weakAssertions.length,
    missingScenarioCount: business.missing.length + api.missing.length,
    modules,
    missingScenarios: [...business.missing, ...api.missing].slice(0, 50),
    weakAssertions: weakAssertions.slice(0, 40),
    unusedAssets,
    recommendations: recommendations.slice(0, 30),
    businessFlows: business.flows,
    duplicateFlows: scriptCov.duplicateFlows,
    apiCoverage: api.summary,
    heatmap,
    coverageGraph: graph,
  };

  await saveCachedCoverage(result, fingerprint);
  return result;
}
