import { loadProjectIndex } from "../projectIntelligence/index.js";
import { loadProjectMemory } from "../aiMemory/aiMemoryStore.js";
import type { ProjectGenerationMode } from "../projectIntelligence/types.js";
import type { ArchitecturePlan } from "./architectureEngine.js";
import type { GeneratedFile } from "./types.js";

export interface IntelligenceContext {
  reusedOrPaths: string[];
  reusedKeywordPaths: string[];
  styleHints: string[];
  warnings: string[];
}

export async function loadIntelligenceContext(
  sourceProjectId: string | undefined,
  reuseMode: ProjectGenerationMode
): Promise<IntelligenceContext> {
  const ctx: IntelligenceContext = {
    reusedOrPaths: [],
    reusedKeywordPaths: [],
    styleHints: [],
    warnings: [],
  };

  if (!sourceProjectId || reuseMode === "generate_everything") {
    return ctx;
  }

  const index = await loadProjectIndex(sourceProjectId);
  if (!index) {
    ctx.warnings.push(`Source project ${sourceProjectId} not found — generating fresh architecture.`);
    return ctx;
  }

  const memory = await loadProjectMemory(sourceProjectId);
  if (memory) {
    ctx.styleHints.push(`Naming: ${memory.naming.testObjectPattern}`);
    ctx.styleHints.push(`Locators: ${memory.locators.dominantStrategy}`);
    ctx.styleHints.push(`Waits: ${memory.waits.dominantPattern}`);
    ctx.styleHints.push(`Assertions: ${memory.assertions.dominantPattern}`);
  }

  const maxOr = reuseMode === "strict_reuse" ? 40 : 15;
  const maxKw = reuseMode === "strict_reuse" ? 20 : 8;

  for (const to of index.testObjects.slice(0, maxOr)) {
    ctx.reusedOrPaths.push(to.path);
  }
  for (const kw of index.keywords.slice(0, maxKw)) {
    ctx.reusedKeywordPaths.push(kw.filePath);
  }

  if (reuseMode === "strict_reuse" && ctx.reusedOrPaths.length === 0) {
    ctx.warnings.push("Strict reuse requested but no OR entries found in source project.");
  }

  return ctx;
}

export function applyIntelligenceToFiles(
  plan: ArchitecturePlan,
  files: GeneratedFile[],
  ctx: IntelligenceContext
): GeneratedFile[] {
  if (ctx.reusedOrPaths.length === 0 && ctx.styleHints.length === 0) return files;

  const root = plan.projectName;
  const extra: GeneratedFile[] = [];

  if (ctx.styleHints.length > 0) {
    extra.push({
      path: `${root}/ai/project-memory-hints.json`,
      kind: "ai",
      content: JSON.stringify(
        {
          sourceProjectId: ctx.reusedOrPaths.length ? "linked" : null,
          styleHints: ctx.styleHints,
          reuseMode: "applied",
        },
        null,
        2
      ),
      summary: "AI Memory style hints",
    });
  }

  for (const orPath of ctx.reusedOrPaths.slice(0, 10)) {
    extra.push({
      path: `${root}/ai/reuse-map/${orPath.replace(/\//g, "_")}.json`,
      kind: "ai",
      content: JSON.stringify({ originalPath: orPath, action: "reference-on-import" }, null, 2),
      summary: `Reuse map for ${orPath}`,
    });
  }

  return [...files, ...extra];
}
