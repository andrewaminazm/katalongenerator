import { analyzeIntent } from "../aiOrchestrator/intentEngine.js";
import type { AutomationIntentType } from "../aiOrchestrator/types.js";
import type { WorkspaceAgent, WorkspaceIntent } from "./types.js";

export interface RoutedIntent {
  intent: WorkspaceIntent;
  agent: WorkspaceAgent;
  confidence: number;
  orchestratorIntent: AutomationIntentType;
  secondaryIntents: WorkspaceIntent[];
}

function mapOrchestratorIntent(type: AutomationIntentType): { intent: WorkspaceIntent; agent: WorkspaceAgent } {
  switch (type) {
    case "apiGeneration":
      return { intent: "api", agent: "api_agent" };
    case "performanceAnalysis":
    case "frameworkOptimization":
      return { intent: "performance", agent: "performance_agent" };
    case "projectAnalysis":
    case "flakyTestAnalysis":
      return { intent: "analyze", agent: "project_intelligence" };
    case "locatorHealing":
      return { intent: "heal", agent: "healing_agent" };
    case "codeReview":
    case "frameworkArchitecture":
      return { intent: "review", agent: "review_agent" };
    case "frameworkRefactor":
      return { intent: "optimize", agent: "review_agent" };
    case "debugging":
      return { intent: "explain", agent: "qa_advisor" };
    case "conversationalAdvice":
      return { intent: "explain", agent: "qa_advisor" };
    case "keywordGeneration":
    case "utilityGeneration":
    case "pageObjectGeneration":
    case "testGeneration":
    case "dbUtilityGeneration":
      return { intent: "generate", agent: "script_generator" };
    case "migration":
      return { intent: "convert", agent: "api_agent" };
    default:
      return { intent: "unknown", agent: "qa_advisor" };
  }
}

function boostFromKeywords(lower: string): Partial<RoutedIntent> | null {
  if (/\b(postman|swagger|openapi)\b/.test(lower) && /\b(convert|import|export)\b/.test(lower)) {
    return { intent: "convert", agent: "api_agent", confidence: 0.88 };
  }
  if (/\b(jmeter|k6|load test|performance strategy|soak|spike)\b/.test(lower)) {
    return { intent: "performance", agent: "performance_agent", confidence: 0.9 };
  }
  if (/\b(documentation|docs|pdf|guide)\b/.test(lower) && /\b(project|generate)\b/.test(lower)) {
    return { intent: "document", agent: "documentation_agent", confidence: 0.85 };
  }
  if (/\b(project intelligence|project analyze|analyze project)\b/.test(lower)) {
    return { intent: "analyze", agent: "project_intelligence", confidence: 0.9 };
  }
  if (/\b(negative scenario|assertion|api test)\b/.test(lower) && /\b(api|rest|endpoint)\b/.test(lower)) {
    return { intent: "api", agent: "api_agent", confidence: 0.86 };
  }
  return null;
}

export function routeWorkspaceIntent(message: string, steps?: string[]): RoutedIntent {
  const analysis = analyzeIntent(message, steps);
  const mapped = mapOrchestratorIntent(analysis.primary);
  const lower = message.toLowerCase();
  const boost = boostFromKeywords(lower);

  const secondaryIntents = analysis.secondary
    .map((t) => mapOrchestratorIntent(t).intent)
    .filter((i) => i !== mapped.intent);

  if (boost) {
    return {
      intent: boost.intent ?? mapped.intent,
      agent: boost.agent ?? mapped.agent,
      confidence: boost.confidence ?? analysis.confidence,
      orchestratorIntent: analysis.primary,
      secondaryIntents,
    };
  }

  return {
    intent: mapped.intent,
    agent: mapped.agent,
    confidence: analysis.confidence,
    orchestratorIntent: analysis.primary,
    secondaryIntents,
  };
}
