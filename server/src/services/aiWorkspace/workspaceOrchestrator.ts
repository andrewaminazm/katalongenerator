import { enrichWorkspaceContext } from "./contextManager.js";
import { getOrCreateSession, saveSession } from "./conversationStore.js";
import { routeWorkspaceIntent } from "./intentRouter.js";
import { runWorkspaceAgent } from "./agents/runAgents.js";
import type { WorkspaceChatRequest, WorkspaceChatResponse } from "./types.js";

function defaultSuggestions(intent: string): string[] {
  const base = [
    "Generate login test for my active project",
    "Analyze flaky locators in Project Intelligence",
    "Create API suite from attached Swagger",
  ];
  if (intent === "performance") base.push("Generate smoke load strategy for checkout APIs");
  return base.slice(0, 4);
}

export async function handleWorkspaceChat(req: WorkspaceChatRequest): Promise<WorkspaceChatResponse> {
  const message = String(req.message ?? "").trim();
  if (!message) {
    throw new Error("message is required");
  }

  const context = req.context ?? {};
  const session = await getOrCreateSession(req.sessionId, context);
  const enriched = await enrichWorkspaceContext(session.context);

  const route = routeWorkspaceIntent(message, context.steps);
  const agentResult = await runWorkspaceAgent(route, message, enriched, req);

  const userMsg = {
    id: `m-${Date.now()}-u`,
    role: "user" as const,
    content: message,
    timestamp: new Date().toISOString(),
  };
  const assistantMsg = {
    id: `m-${Date.now()}-a`,
    role: "assistant" as const,
    content: agentResult.response,
    timestamp: new Date().toISOString(),
    intent: route.intent,
    agent: route.agent,
  };

  session.messages.push(userMsg, assistantMsg);
  session.updatedAt = new Date().toISOString();
  await saveSession(session);

  const suggestions =
    agentResult.suggestions.length > 0
      ? agentResult.suggestions
      : defaultSuggestions(route.intent);

  return {
    sessionId: session.id,
    intent: route.intent,
    agent: route.agent,
    response: agentResult.response,
    actions: agentResult.actions,
    generatedAssets: agentResult.generatedAssets,
    suggestions,
    confidence: route.confidence,
    code: agentResult.code,
    model: agentResult.model,
    warnings: agentResult.warnings,
  };
}
