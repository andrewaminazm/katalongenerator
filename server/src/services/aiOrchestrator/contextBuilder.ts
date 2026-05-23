import { loadProjectIndex } from "../projectIntelligence/projectStore.js";
import { extractProjectDefaultUrl } from "../projectIntelligence/projectUrlResolver.js";
import {
  buildMemoryContextForGeneration,
  resolveAiMemoryMode,
  shouldInjectMemory,
} from "../aiMemory/index.js";
import { listHealingMemory } from "../healing/index.js";
import type { OrchestratorContext, OrchestratorInput } from "./types.js";
import { loadConversationPrefs } from "./conversationMemory.js";

export async function buildOrchestratorContext(
  input: OrchestratorInput
): Promise<OrchestratorContext> {
  const steps = input.steps?.length ? input.steps : input.prompt.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const prefs = await loadConversationPrefs(input.projectId);
  const conversationPrefs: string[] = [];
  if (prefs.prefersPageObjects) conversationPrefs.push("Prefer Page Object Model");
  if (prefs.prefersKeywords) conversationPrefs.push("Prefer custom keywords over raw WebUI");
  if (prefs.prefersSoftAssertions) conversationPrefs.push("Prefer soft assertions");
  if (prefs.prefersCustomWaits) conversationPrefs.push("Prefer custom wait helpers");

  const ctx: OrchestratorContext = {
    projectId: input.projectId,
    reusableFlowHints: [],
    healingHints: [],
    conversationPrefs,
    mergedLocators: input.locators,
    projectDefaultUrl: input.url,
  };

  if (!input.projectId) return ctx;

  const index = await loadProjectIndex(input.projectId);
  if (!index) return ctx;

  if (!ctx.projectDefaultUrl) {
    const scripts = index.testScripts ?? index.testCases ?? [];
    ctx.projectDefaultUrl = extractProjectDefaultUrl(scripts) ?? undefined;
  }

  const memoryMode = resolveAiMemoryMode(input.aiMemoryMode);
  if (shouldInjectMemory(memoryMode)) {
    const styleCtx = await buildMemoryContextForGeneration(
      input.projectId,
      steps,
      index,
      memoryMode
    );
    if (styleCtx?.injectionText) {
      ctx.aiMemoryInjection = styleCtx.injectionText;
      ctx.styleProfileSummary = styleCtx.profile.codingStyleSummary.join("; ");
    }
    if (styleCtx?.styleMatchHints?.length) {
      ctx.reusableFlowHints = styleCtx.styleMatchHints;
    }
  }

  if (index.keywords?.length) {
    ctx.projectHint = `Project has ${index.keywords.length} custom keywords; reuse when possible.`;
  }

  try {
    const healing = await listHealingMemory(10);
    if (healing.length > 0) {
      ctx.healingHints = healing
        .slice(0, 5)
        .map((h) => `${h.stepId}@${h.urlPattern}: ${h.locatorType}=${h.locatorValue}`);
    }
  } catch {
    /* optional */
  }

  return ctx;
}
