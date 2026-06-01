import { looksLikeTestStepLine } from "../testDsl/groovyUtilityIntent.js";
import type { WorkspaceContextPayload, WorkspaceIntent } from "./types.js";
import {
  formatAgentActivationBlock,
  selectQaAgentsForRequest,
  backendAgentsInvoked,
  type QaOrchestratorAgentId,
} from "./qaOrchestratorAgents.js";
import type { RoutedIntent } from "./intentRouter.js";
import {
  QA_ORCHESTRATOR_EVIDENCE_RULES,
  QA_ORCHESTRATOR_RESPONSE_FORMAT,
} from "./qaOrchestratorPrompt.js";
import {
  EXECUTIVE_QA_INTELLIGENCE_REMINDER,
  wantsExecutiveQaIntelligenceReport,
} from "../executionReport/executiveQaIntelligencePrompt.js";

const FORBIDDEN_CODE_MARKERS = [
  /UNPARSED STEP/i,
  /UNKNOWN LOCATOR/i,
  /TODO IMPLEMENT/i,
  /\bPLACEHOLDER\b/i,
];

const GENERATION_VERB =
  /\b(create|generate|write|build|automate|make|develop|draft)\b/i;
const GENERATION_NOUN =
  /\b(script|test|keyword|case|scenario|suite|login|checkout|registration|flow)\b/i;

export function containsForbiddenPlaceholderCode(code: string): boolean {
  return FORBIDDEN_CODE_MARKERS.some((re) => re.test(code));
}

export function hasLocatorLikeDetail(text: string): boolean {
  return /[#\[@]|xpath|css\s*=|findTestObject|data-testid|name\s*=|id\s*=|\.(?:click|setText)\(/i.test(
    text
  );
}

/** Enough detail to run the deterministic Katalon compiler without garbage output. */
export function hasActionableGenerationInput(
  message: string,
  steps: string[],
  payload: WorkspaceContextPayload
): boolean {
  if (payload.locators?.length) return true;

  const actionableSteps = steps.filter(
    (s) => looksLikeTestStepLine(s) || hasLocatorLikeDetail(s)
  );
  if (actionableSteps.length >= 2) return true;
  if (actionableSteps.length >= 1 && payload.pageUrl?.trim()) return true;
  if (steps.some(hasLocatorLikeDetail)) return true;

  if (looksLikeTestStepLine(message) && message.split(/\n/).filter(Boolean).length >= 2) {
    return true;
  }

  return false;
}

/** High-level "create login script" with no steps, locators, or URL. */
export function isVagueGenerationRequest(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (!GENERATION_VERB.test(trimmed) || !GENERATION_NOUN.test(trimmed)) return false;

  const lines = trimmed.split(/\n/).map((s) => s.trim()).filter(Boolean);
  if (lines.length === 1 && lines[0].length < 160 && !looksLikeTestStepLine(lines[0])) {
    return true;
  }

  const hasActionLine = lines.some((l) => looksLikeTestStepLine(l) || hasLocatorLikeDetail(l));
  return lines.length <= 2 && !hasActionLine;
}

export function shouldAnalyzeBeforeGeneration(
  message: string,
  steps: string[],
  payload: WorkspaceContextPayload
): boolean {
  if (hasActionableGenerationInput(message, steps, payload)) return false;
  if (isVagueGenerationRequest(message)) return true;
  if (GENERATION_VERB.test(message) && GENERATION_NOUN.test(message)) return true;
  return false;
}

const INTENT_LABELS: Record<WorkspaceIntent, string> = {
  generate: "Script Generation",
  api: "API Generation",
  analyze: "Coverage / Project Analysis",
  explain: "Requirement / Advisory Analysis",
  heal: "Locator Healing",
  review: "Automation Review",
  optimize: "Framework Refactoring",
  performance: "Performance Testing",
  convert: "API Migration / Conversion",
  document: "Documentation",
  unknown: "General QA Advisory",
};

export function formatDetectedIntentBlock(intent: WorkspaceIntent, confidence: number): string {
  const label = INTENT_LABELS[intent] ?? intent;
  return `**Detected Intent:** ${label}\n**Confidence:** ${Math.round(confidence * 100)}%`;
}

export function buildSeniorQaUnifiedTask(
  message: string,
  intent: WorkspaceIntent,
  confidence: number,
  platform: string,
  payload: WorkspaceContextPayload,
  supplementaryContext?: string,
  route?: RoutedIntent,
  orchestrationOpts?: {
    agents?: QaOrchestratorAgentId[];
    backendInvoked?: Parameters<typeof backendAgentsInvoked>[0];
  }
): string {
  const projectLine = payload.projectId
    ? `Active project ID: ${payload.projectId}`
    : "No active project selected in workspace context.";

  const intentFocus = intentFocusGuidance(intent);
  const agents =
    orchestrationOpts?.agents ??
    (route ? selectQaAgentsForRequest(route, message) : selectQaAgentsForRequest(
        { intent, agent: "qa_advisor", confidence, orchestratorIntent: "conversationalAdvice", secondaryIntents: [] },
        message
      ));
  const agentBlock = formatAgentActivationBlock(agents, intent, confidence);
  const backendBlock = orchestrationOpts?.backendInvoked
    ? backendAgentsInvoked(orchestrationOpts.backendInvoked)
    : "";
  const executiveReport = wantsExecutiveQaIntelligenceReport(message, intent);
  const responseFormat = executiveReport
    ? EXECUTIVE_QA_INTELLIGENCE_REMINDER
    : QA_ORCHESTRATOR_RESPONSE_FORMAT;
  const executiveFocus = executiveReport
    ? "\n**Executive mode:** Produce the full **12-section AI Executive QA Intelligence Report** (Sections 1–12). Section 12 deployment recommendation is mandatory. Cluster failures in Section 5 — no laundry list."
    : "";

  return `${agentBlock}

You are the QA Director (${formatDetectedIntentBlock(intent, confidence)}). Coordinate the activated agents, then merge into one response.

Read conversation history in session context. The latest message may be a short follow-up.

**Latest user message:** ${message}
**Session context:** Platform=${platform}; ${projectLine}

${intentFocus}${executiveFocus}

${backendBlock ? `${backendBlock}\n` : ""}
${supplementaryContext ? `## Supplementary workspace data (ground agent findings in this)\n${supplementaryContext}\n` : ""}

${QA_ORCHESTRATOR_EVIDENCE_RULES}

CRITICAL RULES:
- Simulate only activated agents; deduplicate across agents.
- NEVER output UNPARSED STEP, UNKNOWN LOCATOR, TODO IMPLEMENT, or PLACEHOLDER markers.
- Section 2 metrics MUST follow evidence rules — use EVIDENCE PACK numbers or Unknown.
- Section 6 references UI-attached artifacts; do not duplicate full Groovy in markdown.
- Tag findings with P0–P4 where appropriate.

${responseFormat}`;
}

function intentFocusGuidance(intent: WorkspaceIntent): string {
  switch (intent) {
    case "analyze":
      return "**Focus:** Project/framework health, risks, flaky tests, coverage gaps, OR/keyword debt, release readiness.";
    case "generate":
      return "**Focus:** Test/keyword/class/page-object request — confirm platform, locators, data, assertions, and framework fit before any automation.";
    case "api":
      return "**Focus:** API functional/negative/contract/security testing, auth chaining, assertion strategy, folder structure.";
    case "performance":
      return "**Focus:** Workload model, SLA risks, smoke/load/stress/soak scenarios, environment and data prerequisites.";
    case "heal":
      return "**Focus:** Locator stability, healing strategy, OR cleanup, fallback locators, flakiness prevention.";
    case "review":
    case "optimize":
      return "**Focus:** Framework architecture, maintainability, naming, layering, duplication, scalability.";
    case "explain":
      return "**Focus:** Failure/root-cause analysis with confidence score, fixes, and prevention.";
    case "document":
      return "**Focus:** Test documentation structure, traceability, coverage mapping, stakeholder clarity.";
    case "convert":
      return "**Focus:** Migration/conversion risks, mapping strategy, regression scope after conversion.";
    default:
      return "**Focus:** Practical QA engineering guidance grounded in workspace context.";
  }
}

export function buildGeneralSeniorQaTask(
  intent: WorkspaceIntent,
  confidence: number
): string {
  return `${formatDetectedIntentBlock(intent, confidence)}

Respond as a Senior Automation QA Engineer — analyze first, then advise or generate.

Use these sections:
## Understanding
## Analysis
## Missing Information
## Assumptions
## Recommended Test Design
## Generated Output

Never emit UNPARSED STEP, UNKNOWN LOCATOR, TODO IMPLEMENT, or PLACEHOLDER code.`;
}

export function buildSeniorQaAnalysisTask(
  message: string,
  intent: WorkspaceIntent,
  confidence: number,
  platform: string,
  payload: WorkspaceContextPayload
): string {
  const projectLine = payload.projectId
    ? `Active project ID: ${payload.projectId}`
    : "No active project selected in workspace context.";

  return `${formatDetectedIntentBlock(intent, confidence)}

The user is asking for automation or test output, but the request lacks sufficient detail for blind template compilation.

**User request:** ${message}

**Session context:** Platform=${platform}; ${projectLine}

CRITICAL RULES:
- You are a Senior Automation QA Engineer — NOT a template compiler.
- Perform QA analysis BEFORE any code.
- NEVER output UNPARSED STEP, UNKNOWN LOCATOR, TODO IMPLEMENT, or PLACEHOLDER markers.
- If you include Groovy in Generated Output, it must be complete, assumption-based, enterprise-grade Katalon code with real steps and assertions — or omit code and ask targeted questions instead.

Use these sections in order:
## Understanding
## Analysis
## Missing Information
## Assumptions
## Recommended Test Design
(positive, negative, boundary, validation, and error-handling scenarios)
## Generated Output
(test cases, test data, and/or Katalon Groovy only when assumptions are explicit)`;
}
