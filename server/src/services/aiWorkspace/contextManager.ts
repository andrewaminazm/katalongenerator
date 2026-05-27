import { loadProjectIndex } from "../projectIntelligence/index.js";
import { loadConversationPrefs } from "../aiOrchestrator/conversationMemory.js";
import {
  buildMemoryContextForGeneration,
  resolveAiMemoryMode,
  shouldInjectMemory,
} from "../aiMemory/index.js";
import { retrieveForChat } from "../workspaceMemory/retrievalEngine.js";
import type { RetrievalContext } from "../workspaceMemory/types.js";
import type { WorkspaceContextPayload } from "./types.js";

export interface EnrichedWorkspaceContext {
  payload: WorkspaceContextPayload;
  projectSummary?: string;
  aiMemoryInjection?: string;
  workspaceMemoryInjection?: string;
  workspaceMemoryCitations?: RetrievalContext["citations"];
  conversationPrefsSummary?: string;
}

export async function enrichWorkspaceContext(
  payload: WorkspaceContextPayload,
  userMessage?: string
): Promise<EnrichedWorkspaceContext> {
  const enriched: EnrichedWorkspaceContext = { payload };

  if (payload.projectId) {
    const index = await loadProjectIndex(payload.projectId);
    if (index) {
      enriched.projectSummary = [
        `Project: ${index.projectName ?? payload.projectId}`,
        `OR objects: ${index.stats.testObjects}`,
        `Keywords: ${index.stats.keywords}`,
        `Scripts: ${index.stats.testScripts}`,
        `Generation mode hint: ${payload.projectGenerationMode ?? "balanced"}`,
      ].join(" · ");
    }

    const memoryMode = resolveAiMemoryMode(payload.aiMemoryMode ?? "learn_suggest");
    if (shouldInjectMemory(memoryMode)) {
      const steps = payload.steps ?? [];
      const styleCtx = await buildMemoryContextForGeneration(
        payload.projectId,
        steps,
        index,
        memoryMode
      );
      if (styleCtx?.injectionText) enriched.aiMemoryInjection = styleCtx.injectionText;
    }

    if (payload.workspaceMemoryEnabled !== false && userMessage?.trim()) {
      const retrieval = await retrieveForChat(payload.projectId, userMessage, 8);
      if (retrieval?.injectionText) {
        enriched.workspaceMemoryInjection = retrieval.injectionText;
        enriched.workspaceMemoryCitations = retrieval.citations;
      }
    }

    const prefs = await loadConversationPrefs(payload.projectId);
    enriched.conversationPrefsSummary = [
      prefs.prefersKeywords ? "prefers keywords" : null,
      prefs.prefersPageObjects ? "prefers page objects" : null,
      prefs.prefersCustomWaits ? "prefers custom waits" : null,
      prefs.recentTopics.length ? `recent: ${prefs.recentTopics.slice(-3).join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("; ");
  }

  return enriched;
}

export function buildSystemContextBlock(ctx: EnrichedWorkspaceContext): string {
  const lines: string[] = [
    "You are a senior QA architect and Katalon automation expert inside Katalon Script Generator.",
    "Explain WHY, cite risks, and follow enterprise QA best practices.",
    "Never claim tests were executed — generation and analysis are advisory unless stated otherwise.",
  ];

  if (ctx.payload.activeTab) lines.push(`User UI context tab: ${ctx.payload.activeTab}`);
  if (ctx.payload.platform) lines.push(`Platform: ${ctx.payload.platform}`);
  if (ctx.projectSummary) lines.push(`Active project index: ${ctx.projectSummary}`);
  if (ctx.aiMemoryInjection) lines.push(`Team style (AI memory):\n${ctx.aiMemoryInjection.slice(0, 4000)}`);
  if (ctx.workspaceMemoryInjection) {
    lines.push(ctx.workspaceMemoryInjection.slice(0, 8000));
  }
  if (ctx.conversationPrefsSummary) lines.push(`Conversation prefs: ${ctx.conversationPrefsSummary}`);
  if (ctx.payload.pageUrl) lines.push(`Page URL context: ${ctx.payload.pageUrl}`);
  if (ctx.payload.swagger?.trim()) {
    lines.push(`Attached OpenAPI/Swagger (truncated):\n${ctx.payload.swagger.trim().slice(0, 6000)}`);
  }
  if (ctx.payload.postmanCollection?.trim()) {
    lines.push(`Attached Postman collection (truncated):\n${ctx.payload.postmanCollection.trim().slice(0, 6000)}`);
  }
  if (ctx.payload.steps?.length) {
    lines.push(`User steps:\n${ctx.payload.steps.join("\n")}`);
  }

  return lines.join("\n");
}
