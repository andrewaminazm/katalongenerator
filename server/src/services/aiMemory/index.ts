export * from "./types.js";
export * from "./aiMemoryStore.js";
export * from "./projectPatternScanner.js";
export * from "./generationContextBuilder.js";
export * from "./similarityMatcher.js";

import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { AiMemoryMode, GenerationStyleContext, StyleMatchReport } from "./types.js";
import { scanProjectPatterns } from "./projectPatternScanner.js";
import { saveProjectMemory, loadProjectMemory, deleteProjectMemory } from "./aiMemoryStore.js";
import { buildGenerationStyleContext } from "./generationContextBuilder.js";

export async function buildAndSaveProjectMemory(index: ProjectIndex): Promise<import("./types.js").ProjectMemoryProfile> {
  const profile = scanProjectPatterns(index);
  await saveProjectMemory(profile);
  return profile;
}

export async function getProjectMemory(projectId: string) {
  return loadProjectMemory(projectId);
}

export async function rebuildProjectMemoryFromIndex(
  index: ProjectIndex
): Promise<import("./types.js").ProjectMemoryProfile> {
  return buildAndSaveProjectMemory(index);
}

export function resolveAiMemoryMode(raw: unknown): AiMemoryMode {
  const allowed: AiMemoryMode[] = ["disabled", "learn_only", "learn_suggest", "adaptive"];
  if (typeof raw === "string" && (allowed as string[]).includes(raw)) {
    return raw as AiMemoryMode;
  }
  return "learn_suggest";
}

export function shouldInjectMemory(mode: AiMemoryMode): boolean {
  return mode === "learn_suggest" || mode === "adaptive";
}

export function shouldAdaptGeneration(mode: AiMemoryMode): boolean {
  return mode === "adaptive";
}

export async function buildMemoryContextForGeneration(
  projectId: string | undefined,
  steps: string[],
  index: ProjectIndex | null,
  mode: AiMemoryMode
): Promise<GenerationStyleContext | null> {
  if (!projectId || mode === "disabled" || !index) return null;

  let profile = await loadProjectMemory(projectId);
  if (!profile) {
    profile = await buildAndSaveProjectMemory(index);
  }
  if (mode === "learn_only") return null;

  const testScripts = index.testScripts ?? index.testCases ?? [];
  return buildGenerationStyleContext(profile, steps, testScripts, mode);
}

export function computeStyleMatchReport(
  code: string,
  profile: import("./types.js").ProjectMemoryProfile | null
): StyleMatchReport {
  if (!profile) {
    return { styleMatchScore: 0, reusedHelpers: [], matchedPatterns: [], matchedArchitecture: [] };
  }

  const reusedHelpers: string[] = [];
  const matchedPatterns: string[] = [];
  const matchedArchitecture: string[] = [];

  for (const kw of profile.topKeywords.slice(0, 15)) {
    if (code.includes(kw.path) || code.includes(kw.path.split(".").pop() ?? "")) {
      reusedHelpers.push(kw.path);
    }
  }

  if (profile.locators.dominantStrategy === "object_repository" && /findTestObject\s*\(/.test(code)) {
    matchedPatterns.push("object_repository");
  }
  if (profile.waits.dominantPattern === "custom_wait") {
    for (const w of profile.waits.customWaitKeywords) {
      if (code.includes(w)) matchedPatterns.push("custom_wait");
    }
  }
  if (profile.architecture.keywordDrivenScore > 0.35 && /CustomKeywords/.test(code)) {
    matchedArchitecture.push("keyword_driven");
  }

  let score = 0.25;
  if (reusedHelpers.length > 0) score += Math.min(0.35, reusedHelpers.length * 0.08);
  if (matchedPatterns.length > 0) score += 0.2;
  if (matchedArchitecture.length > 0) score += 0.15;
  if (/findTestObject/.test(code) && profile.locators.dominantStrategy === "object_repository") {
    score += 0.1;
  }

  return {
    styleMatchScore: Math.min(1, score * profile.confidence),
    reusedHelpers,
    matchedPatterns: [...new Set(matchedPatterns)],
    matchedArchitecture: [...new Set(matchedArchitecture)],
  };
}

export { deleteProjectMemory };
