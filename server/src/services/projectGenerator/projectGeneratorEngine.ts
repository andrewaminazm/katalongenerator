import { createHash } from "node:crypto";
import { architectureSummary, buildArchitecturePlan } from "./architectureEngine.js";
import { generateApiFramework } from "./apiFrameworkGenerator.js";
import { generateBddLayer, generateDataDrivenLayer } from "./frameworkGenerator.js";
import { generateKeywords } from "./keywordGenerator.js";
import { generateMobileFramework } from "./mobileFrameworkGenerator.js";
import { generatePageObjects } from "./pageObjectGenerator.js";
import { generatePerformanceFramework } from "./performanceFrameworkGenerator.js";
import { generateSuites } from "./suiteGenerator.js";
import { generateDocumentation } from "./documentationGenerator.js";
import { computeFrameworkHealth } from "./frameworkHealthGenerator.js";
import { buildDependencyGraph } from "./dependencyGraphGenerator.js";
import {
  applyIntelligenceToFiles,
  loadIntelligenceContext,
} from "./intelligenceIntegration.js";
import {
  buildModuleSummary,
  dedupeFiles,
  validateGeneratedGroovy,
} from "./projectAssembler.js";
import { scaffoldProjectTree } from "./projectScaffolder.js";
import {
  inputFingerprint,
  loadCachedGeneration,
  saveCachedGeneration,
  loadCachedGenerationMeta,
  loadGenerationFiles,
} from "./cache.js";
import { assembleProjectZip } from "./zipExport.js";
import type {
  ProjectGeneratorAnalyzeOptions,
  ProjectGeneratorAnalyzeResult,
  ProjectGeneratorGenerateOptions,
  ProjectGeneratorInput,
  ProjectGeneratorResult,
} from "./types.js";

function normalizeInput(raw: Partial<ProjectGeneratorInput>): ProjectGeneratorInput {
  return {
    projectName: String(raw.projectName ?? "EnterpriseAutomation").trim() || "EnterpriseAutomation",
    description: String(raw.description ?? ""),
    frameworkKind: raw.frameworkKind ?? "hybrid",
    architecturePattern: raw.architecturePattern ?? "layered",
    domain: raw.domain ?? "generic",
    projectSize: raw.projectSize ?? "standard",
    reuseMode: raw.reuseMode ?? "balanced",
    sourceProjectId: raw.sourceProjectId?.trim() || undefined,
    inputSources: Array.isArray(raw.inputSources) ? raw.inputSources : ["description"],
    businessFlows: Array.isArray(raw.businessFlows) ? raw.businessFlows : [],
    modules: Array.isArray(raw.modules) ? raw.modules : [],
    includeReporting: raw.includeReporting !== false,
    includeBdd: raw.includeBdd === true,
    includePerformance:
      raw.includePerformance === true || raw.frameworkKind === "performance" || raw.frameworkKind === "hybrid",
    includeMobile:
      raw.includeMobile === true || raw.frameworkKind === "mobile" || raw.frameworkKind === "hybrid",
    swaggerText: raw.swaggerText,
    postmanText: raw.postmanText,
    jiraEpic: raw.jiraEpic,
  };
}

function generationIdFor(input: ProjectGeneratorInput): string {
  return createHash("sha256").update(inputFingerprint(input)).digest("hex").slice(0, 16);
}

export async function analyzeProjectGeneration(
  options: ProjectGeneratorAnalyzeOptions
): Promise<ProjectGeneratorAnalyzeResult> {
  const input = normalizeInput(options.input);
  const plan = buildArchitecturePlan(input);
  const generationId = generationIdFor(input);
  const estimatedFileCount =
    30 +
    plan.modules.length * 4 +
    (plan.includeApi ? 12 : 0) +
    (plan.includeMobile ? 8 : 0) +
    (plan.includePerformance ? 6 : 0);

  const warnings: string[] = [];
  if (input.sourceProjectId) {
    const ctx = await loadIntelligenceContext(input.sourceProjectId, input.reuseMode);
    warnings.push(...ctx.warnings);
  }

  return {
    generationId,
    projectName: plan.projectName,
    inferredModules: plan.modules,
    inferredFlows: plan.flows,
    architectureSummary: architectureSummary(plan),
    recommendedPattern: input.architecturePattern,
    estimatedFileCount,
    warnings,
  };
}

export async function generateEnterpriseProject(
  options: ProjectGeneratorGenerateOptions
): Promise<ProjectGeneratorResult> {
  const input = normalizeInput(options.input);
  const generationId = generationIdFor(input);
  const fingerprint = inputFingerprint(input);

  if (!options.forceRefresh) {
    const cached = await loadCachedGeneration(generationId, fingerprint);
    if (cached) {
      const files = await loadGenerationFiles(generationId);
      if (files) return { ...cached, files, fromCache: true };
    }
  }

  const plan = buildArchitecturePlan(input);
  const intelCtx = await loadIntelligenceContext(input.sourceProjectId, input.reuseMode);
  const warnings: string[] = [...intelCtx.warnings];

  const kw = generateKeywords(plan);
  const pages = generatePageObjects(plan);
  const api = generateApiFramework(plan);
  const suites = generateSuites(plan);

  let files = dedupeFiles([
    ...scaffoldProjectTree(plan),
    ...kw.files,
    ...pages.files,
    ...api.files,
    ...generateMobileFramework(plan),
    ...generatePerformanceFramework(plan),
    ...generateDataDrivenLayer(plan),
    ...generateBddLayer(plan),
    ...suites.files,
  ]);

  files = applyIntelligenceToFiles(plan, files, intelCtx);

  const docStats = { fileCount: files.length, moduleCount: plan.modules.length };
  const docs = generateDocumentation(plan, docStats);
  files = dedupeFiles([...files, ...docs.files]);

  warnings.push(...validateGeneratedGroovy(files));

  const health = computeFrameworkHealth({
    files,
    pages: pages.pages,
    keywords: kw.keywords,
    warnings,
  });

  const dependencyGraph = buildDependencyGraph({
    pages: pages.pages,
    keywords: kw.keywords,
    apis: api.apis,
    files,
  });

  const zipPath = await assembleProjectZip(generationId, files);

  const result: ProjectGeneratorResult = {
    generationId,
    projectName: plan.projectName,
    frameworkType: plan.frameworkKind,
    architecturePattern: plan.architecturePattern,
    generatedAt: new Date().toISOString(),
    fromCache: false,
    healthScore: health.overallScore,
    frameworkHealth: health,
    generatedModules: buildModuleSummary(plan, files),
    pages: pages.pages,
    keywords: kw.keywords,
    apis: api.apis,
    suites: suites.suites,
    documentation: docs.docs,
    files,
    dependencyGraph,
    warnings,
    zipPath,
  };

  await saveCachedGeneration(result, fingerprint);
  return result;
}

export async function loadProjectGeneratorPreview(
  generationId: string
): Promise<ProjectGeneratorResult | null> {
  const meta = await loadCachedGenerationMeta(generationId);
  const files = await loadGenerationFiles(generationId);
  if (!meta || !files) return null;
  return { ...meta, files, fromCache: true } as ProjectGeneratorResult;
}

export { normalizeInput, generationIdFor };
