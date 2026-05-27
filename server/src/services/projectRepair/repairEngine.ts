import { randomUUID } from "node:crypto";
import { loadProjectMemory } from "../aiMemory/aiMemoryStore.js";
import { loadProjectIndex } from "../projectIntelligence/index.js";
import { buildProjectGraphV2 } from "../projectIntelligenceV2/projectGraphV2.js";
import { loadScriptContents } from "../projectIntelligenceV2/sourceLoader.js";
import { analyzeOrRefactoring } from "../refactorAssistant/orRefactorAnalyzer.js";
import { analyzeProjectStructure } from "../refactorAssistant/projectStructureAnalyzer.js";
import { analyzeApiRepairs } from "./apiRepairEngine.js";
import { analyzeAssertionRepairs } from "./assertionRepairEngine.js";
import { indexFingerprint, loadCachedRepair, saveCachedRepair } from "./cache.js";
import { detectDuplicateCode } from "./duplicateCodeDetector.js";
import { analyzeDependencies } from "./dependencyRepairEngine.js";
import { analyzeFrameworkRepairs } from "./frameworkRepairEngine.js";
import { buildFrameworkHealth } from "./frameworkHealthEngine.js";
import { analyzeGroovyScripts, repairGroovyScript } from "./groovyRepairEngine.js";
import { analyzeImports, repairImports } from "./importRepairEngine.js";
import { analyzeLocators } from "./locatorRepairEngine.js";
import { analyzeMobileRepairs } from "./mobileRepairEngine.js";
import { analyzePerformanceRepairs } from "./performanceRepairEngine.js";
import { filterApplicable, planRepairs } from "./repairPlanner.js";
import { createRollbackSnapshot, getRollbackSnapshot } from "./rollbackManager.js";
import { buildRepairedProjectZip } from "./repairZipExport.js";
import { analyzeRisks } from "./riskAnalysisEngine.js";
import { analyzeWaitRepairs } from "./waitRepairEngine.js";
import type {
  ProjectRepairAnalysisResult,
  RepairAnalyzeOptions,
  RepairDiff,
  RepairExecuteOptions,
  RepairMode,
} from "./types.js";

async function runFullAnalysis(
  options: RepairAnalyzeOptions,
  mode: RepairMode = "suggest"
): Promise<ProjectRepairAnalysisResult> {
  const index = await loadProjectIndex(options.projectId);
  if (!index) throw new Error("Project not found");

  const fingerprint = indexFingerprint(index);
  if (!options.forceRefresh) {
    const cached = await loadCachedRepair(options.projectId, fingerprint);
    if (cached) return { ...cached, mode };
  }

  const graph = buildProjectGraphV2(index);
  const scripts = await loadScriptContents(
    options.projectId,
    index,
    options.maxScripts ?? 150
  );

  const memory = await loadProjectMemory(options.projectId);
  const warnings: string[] = [];
  if (memory) {
    warnings.push(
      `AI Memory: applying team style (${memory.naming.testObjectPattern}, ${memory.waits.dominantPattern})`
    );
  } else {
    warnings.push("No AI Memory profile — repairs use generic enterprise defaults.");
  }

  const groovy = analyzeGroovyScripts(scripts, index);
  const imports = analyzeImports(scripts);
  const locators = analyzeLocators(index);
  const waits = analyzeWaitRepairs(scripts);
  const assertions = analyzeAssertionRepairs(scripts);
  const dup = detectDuplicateCode(index, graph);
  const framework = analyzeFrameworkRepairs(index, graph, scripts);
  const deps = analyzeDependencies(graph);
  const api = analyzeApiRepairs(scripts);
  const mobile = analyzeMobileRepairs(scripts);
  const perf = analyzePerformanceRepairs(scripts);
  const orRef = analyzeOrRefactoring(index, graph);
  const structure = analyzeProjectStructure(index, scripts);

  const allSuggestions = planRepairs([
    ...groovy,
    ...imports,
    ...locators.suggestions,
    ...waits.suggestions,
    ...assertions.suggestions,
    ...dup.suggestions,
    ...framework.suggestions,
    ...deps.suggestions,
    ...api,
    ...mobile,
    ...perf,
  ]);

  const riskAreas = analyzeRisks(index, scripts, allSuggestions);

  const flakinessScore = Math.round(
    100 -
      (waits.waitStabilityScore +
        assertions.assertionQualityScore +
        orRef.orHealthScore) /
        3
  );

  const frameworkHealth = buildFrameworkHealth({
    duplicationScore: dup.duplicationScore,
    assertionQualityScore: assertions.assertionQualityScore,
    orHealthScore: orRef.orHealthScore,
    waitStabilityScore: waits.waitStabilityScore,
    modularityScore: framework.modularityScore,
    complexityScore: structure.complexityScore,
    flakinessScore: Math.max(0, Math.min(100, flakinessScore)),
    issueCount: allSuggestions.length,
  });

  const repairId = randomUUID().slice(0, 16);

  const result: ProjectRepairAnalysisResult = {
    repairId,
    projectId: options.projectId,
    projectName: index.projectName,
    analyzedAt: new Date().toISOString(),
    fromCache: false,
    healthScore: frameworkHealth.overallHealthScore,
    flakinessScore: frameworkHealth.flakinessScore,
    frameworkHealth,
    repairSuggestions: allSuggestions,
    locatorRepairs: locators.locatorRepairs,
    duplicateFlows: dup.duplicateFlows,
    architectureWarnings: framework.architectureWarnings,
    riskAreas,
    dependencyIssues: deps.dependencyIssues,
    repairDiffs: [],
    repairedFiles: [],
    rollbackAvailable: false,
    warnings,
    mode,
  };

  await saveCachedRepair(result, fingerprint);
  return result;
}

export async function analyzeProjectRepair(
  options: RepairAnalyzeOptions
): Promise<ProjectRepairAnalysisResult> {
  return runFullAnalysis(options, "suggest");
}

export async function previewProjectRepair(
  options: RepairExecuteOptions
): Promise<ProjectRepairAnalysisResult> {
  const analysis = await runFullAnalysis(
    { projectId: options.projectId, forceRefresh: false },
    options.mode ?? "preview"
  );

  if (analysis.repairId !== options.repairId) {
    const fresh = await runFullAnalysis(
      { projectId: options.projectId, forceRefresh: true },
      "preview"
    );
    return applyRepairs(fresh, options, false);
  }

  return applyRepairs(analysis, options, false);
}

export async function executeProjectRepair(
  options: RepairExecuteOptions
): Promise<ProjectRepairAnalysisResult> {
  const analysis = await runFullAnalysis(
    { projectId: options.projectId, forceRefresh: false },
    options.mode ?? "assisted"
  );
  return applyRepairs(analysis, options, true);
}

async function applyRepairs(
  analysis: ProjectRepairAnalysisResult,
  options: RepairExecuteOptions,
  storeRollback: boolean
): Promise<ProjectRepairAnalysisResult> {
  const index = await loadProjectIndex(options.projectId);
  if (!index) throw new Error("Project not found");

  const scripts = await loadScriptContents(options.projectId, index, 150);
  const toApply = filterApplicable(analysis.repairSuggestions, options.suggestionIds);

  const diffs: RepairDiff[] = [];
  const repairedPaths = new Set<string>();

  for (const s of scripts) {
    const shouldRepair = toApply.some(
      (t) =>
        t.autoApplicable &&
        (t.affectedFiles.includes(s.scriptPath) ||
          t.affectedFiles.includes(s.logicalPath) ||
          ["script", "wait", "import"].includes(t.category))
    );
    if (!shouldRepair || repairedPaths.has(s.scriptPath)) continue;
    repairedPaths.add(s.scriptPath);

    const related =
      toApply.find((t) => t.affectedFiles.includes(s.scriptPath)) ?? toApply[0];
    if (!related) continue;

    let diff = repairGroovyScript(s, index, related.id);
    if (related.category === "import") {
      const repaired = repairImports(diff.repaired);
      diff = { ...diff, repaired, changed: diff.original !== repaired };
    }
    if (diff.changed) diffs.push(diff);
  }

  let rollbackId: string | undefined;
  if (storeRollback && diffs.length > 0) {
    const snap = await createRollbackSnapshot({
      repairId: analysis.repairId,
      projectId: options.projectId,
      diffs,
    });
    rollbackId = snap.rollbackId;
  }

  let downloadableZip: string | undefined;
  if (diffs.some((d) => d.changed)) {
    const zipBuilt = await buildRepairedProjectZip({
      projectId: options.projectId,
      repairId: analysis.repairId,
      diffs,
      projectName: analysis.projectName,
    });
    if (zipBuilt) {
      downloadableZip = `/api/project-repair/download/${analysis.repairId}?projectId=${encodeURIComponent(options.projectId)}`;
    }
  }

  const merged: ProjectRepairAnalysisResult = {
    ...analysis,
    repairDiffs: diffs,
    repairedFiles: diffs,
    rollbackAvailable: Boolean(rollbackId),
    rollbackId,
    downloadableZip,
    mode: options.mode ?? analysis.mode,
  };

  await saveCachedRepair(merged, indexFingerprint(index));

  return merged;
}

export async function rollbackProjectRepair(rollbackId: string): Promise<{
  rollbackId: string;
  projectId: string;
  files: Array<{ filePath: string; original: string }>;
  message: string;
}> {
  const snap = await getRollbackSnapshot(rollbackId);
  if (!snap) throw new Error("Rollback snapshot not found");

  return {
    rollbackId: snap.rollbackId,
    projectId: snap.projectId,
    files: snap.files,
    message:
      "Rollback data returned for manual restore — uploaded projects are never modified on the server.",
  };
}

export async function getRepairReport(
  repairId: string,
  projectId: string
): Promise<ProjectRepairAnalysisResult | null> {
  const index = await loadProjectIndex(projectId);
  if (!index) return null;
  const cached = await loadCachedRepair(projectId, indexFingerprint(index));
  if (!cached) return null;
  if (cached.repairId !== repairId) return null;
  return cached;
}
