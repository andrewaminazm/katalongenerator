import { analyzeIntent } from "../aiOrchestrator/intentEngine.js";
import type { AutomationIntentType } from "../aiOrchestrator/types.js";
import { isBilingualProjectReviewRequest, matchBilingualIntentBoost } from "./bilingualText.js";
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

function boostFromKeywords(message: string): Partial<RoutedIntent> | null {
  const bilingual = matchBilingualIntentBoost(message);
  if (bilingual) {
    const mapped = mapOrchestratorIntent(
      bilingual.intent === "analyze"
        ? "projectAnalysis"
        : bilingual.intent === "performance"
          ? "performanceAnalysis"
          : bilingual.intent === "convert"
            ? "migration"
            : "conversationalAdvice"
    );
    return { intent: mapped.intent, agent: mapped.agent, confidence: bilingual.confidence };
  }

  const lower = message.toLowerCase();
  if (
    /\b(check|review|inspect|audit|scan|analyze|look at|evaluate|assess)\b/.test(lower) &&
    /\b(my project|the project|this project|active project|uploaded project|project)\b/.test(lower)
  ) {
    return { intent: "analyze", agent: "project_intelligence", confidence: 0.92 };
  }
  if (/^(check|review|analyze|inspect|audit)\s+(my\s+)?project\.?$/i.test(lower.trim())) {
    return { intent: "analyze", agent: "project_intelligence", confidence: 0.94 };
  }
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
  if (/\b(api|rest|token|webservice)\b/.test(lower) && /\b(negative scenario|assertion|api test)\b/.test(lower)) {
    return { intent: "api", agent: "api_agent", confidence: 0.86 };
  }
  if (
    /\b(help me|can you help|i need help|what should i test|how do i test|why is my|my test)\b/.test(lower)
  ) {
    return { intent: "explain", agent: "qa_advisor", confidence: 0.84 };
  }
  if (/\b(failing|failed|error|broken|flaky|not working)\b/.test(lower)) {
    return { intent: "explain", agent: "qa_advisor", confidence: 0.86 };
  }
  return null;
}

export function isProjectReviewRequest(message: string): boolean {
  if (isBilingualProjectReviewRequest(message)) return true;
  const lower = message.toLowerCase().trim();
  if (/^(check|review|analyze|inspect|audit|scan|look at)\s+(my\s+)?project\.?$/i.test(lower)) {
    return true;
  }
  return (
    /\b(check|review|inspect|audit|scan|analyze|look at|evaluate|assess)\b/.test(lower) &&
    /\b(my project|the project|this project|active project|uploaded project|project)\b/.test(lower)
  );
}

export function routeWorkspaceIntent(message: string, steps?: string[]): RoutedIntent {
  if (isProjectReviewRequest(message)) {
    return {
      intent: "analyze",
      agent: "project_intelligence",
      confidence: 0.92,
      orchestratorIntent: "projectAnalysis",
      secondaryIntents: ["review"],
    };
  }

  const analysis = analyzeIntent(message, steps);
  const mapped = mapOrchestratorIntent(analysis.primary);
  const lower = message.toLowerCase();
  const boost = boostFromKeywords(message);

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
