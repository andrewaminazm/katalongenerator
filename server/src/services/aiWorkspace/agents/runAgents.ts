import { isGosiBrainConfigured } from "../../../loadEnv.js";
import { gosiBrainGenerate, stripGosiBrainCoT } from "../../gosiBrain.js";
import { analyzeProjectV2 } from "../../projectIntelligenceV2/index.js";
import { generatePerformanceSuite } from "../../performanceEngine/index.js";
import { runOrchestration } from "../../aiOrchestrator/index.js";
import type { EnrichedWorkspaceContext } from "../contextManager.js";
import { buildSystemContextBlock } from "../contextManager.js";
import { TEST_ARCHITECT_RESPONSE_FORMAT_REMINDER } from "../testArchitectChatPrompt.js";
import type { RoutedIntent } from "../intentRouter.js";
import { isProjectReviewRequest } from "../intentRouter.js";
import {
  formatDetectedIntentBlock,
  buildSeniorQaUnifiedTask,
  containsForbiddenPlaceholderCode,
} from "../generationReadiness.js";
import {
  collectGenerationSteps,
  enrichPayloadFromChat,
  groovyAssetTitle,
  resolveCodeGenerationMode,
  wantsKatalonScriptGeneration,
} from "../workspaceScriptGeneration.js";
import { SENIOR_QA_ENGINEER_NAME } from "../testArchitectChatPrompt.js";
import type {
  WorkspaceAction,
  WorkspaceChatRequest,
  WorkspaceGeneratedAsset,
  WorkspaceContextPayload,
} from "../types.js";

export interface AgentRunResult {
  response: string;
  actions: WorkspaceAction[];
  generatedAssets: WorkspaceGeneratedAsset[];
  suggestions: string[];
  code?: string;
  model?: string;
  warnings?: string[];
}

async function advisoryReply(
  message: string,
  ctx: EnrichedWorkspaceContext,
  token: string | undefined,
  model: string | undefined,
  extra?: string
): Promise<{ response: string; model: string }> {
  if (!isGosiBrainConfigured() || !token?.trim()) {
    return {
      response:
        extra ??
        `**Advisory (offline)**\n\n${message}\n\nConfigure Gosi Brain on the server or pass an authorization token to enable full Senior QA Engineer responses.`,
      model: "workspace-advisory",
    };
  }
  const prompt = `${buildSystemContextBlock(ctx)}

User request:
${message}

${extra ? `Task context:\n${extra}` : ""}

${TEST_ARCHITECT_RESPONSE_FORMAT_REMINDER}`;

  const { response, model: used } = await gosiBrainGenerate({
    prompt,
    authorizationToken: token,
    model,
    temperature: 0.5,
  });
  return { response: stripGosiBrainCoT(response), model: used };
}

function offlineSeniorQaFallback(
  message: string,
  intent: RoutedIntent["intent"],
  confidence: number,
  platform: string,
  projectId?: string
): string {
  return `${formatDetectedIntentBlock(intent, confidence)}

## Understanding
You asked for QA engineering help: "${message}".

## Analysis
Test Architect Chat always routes through Senior QA analysis first. Gosi Brain is not configured or no auth token was provided, so full reasoning is unavailable.

## Missing Information
- Target platform confirmation (current context: **${platform}**)
- Application URL, locators, or requirements as applicable
${projectId ? "" : "- Active Katalon project (none selected in context panel)"}

## Assumptions
None applied.

## Recommended Test Design
Clarify the goal, scope, and risk areas before generating automation.

## Generated Output
Configure Gosi Brain for full responses from **${SENIOR_QA_ENGINEER_NAME}**. — ${SENIOR_QA_ENGINEER_NAME}`;
}

async function seniorQaAnalysisReply(
  message: string,
  ctx: EnrichedWorkspaceContext,
  route: RoutedIntent,
  token: string | undefined,
  model: string | undefined,
  task: string
): Promise<{ response: string; model: string }> {
  if (!isGosiBrainConfigured() || !token?.trim()) {
    return {
      response: offlineSeniorQaFallback(
        message,
        route.intent,
        route.confidence,
        ctx.payload.platform ?? "web",
        ctx.payload.projectId
      ),
      model: "workspace-senior-qa-offline",
    };
  }

  return advisoryReply(message, ctx, token, model, task);
}

interface SupplementaryContext {
  text: string;
  assets: WorkspaceGeneratedAsset[];
  warnings: string[];
}

async function gatherSupplementaryContext(
  route: RoutedIntent,
  message: string,
  payload: WorkspaceContextPayload
): Promise<SupplementaryContext> {
  const assets: WorkspaceGeneratedAsset[] = [];
  const warnings: string[] = [];
  const parts: string[] = [];

  const wantsProjectAnalysis =
    route.intent === "analyze" ||
    route.agent === "project_intelligence" ||
    isProjectReviewRequest(message);

  if (wantsProjectAnalysis && payload.projectId) {
    try {
      const analysis = await analyzeProjectV2(payload.projectId, {
        healScripts: true,
        healLocators: true,
        generateDocumentation: true,
      });
      const md = analysis.documentation.markdown.slice(0, 12000);
      assets.push({
        kind: "report",
        title: "Project analysis summary",
        content: md,
        language: "markdown",
      });
      parts.push(
        [
          `Project Analyze — risk score ${analysis.insights.riskScore}/100`,
          `Script fixes (changed): ${analysis.fixes.testCases.filter((t) => t.changed).length}`,
          `OR healing proposals: ${analysis.fixes.objectRepository.length}`,
          `Flaky flags: ${analysis.insights.flakyTests.length}`,
          analysis.warnings.length ? `Warnings: ${analysis.warnings.join(" · ")}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      );
      warnings.push(...analysis.warnings);
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (
    route.intent === "document" &&
    payload.projectId &&
    !wantsProjectAnalysis
  ) {
    try {
      const analysis = await analyzeProjectV2(payload.projectId, {
        healScripts: false,
        healLocators: false,
        generateDocumentation: true,
      });
      assets.push({
        kind: "markdown",
        title: "Project documentation",
        content: analysis.documentation.markdown,
        language: "markdown",
      });
      parts.push("Project documentation markdown was generated — summarize key sections for the user.");
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : String(e));
    }
  }

  if (
    route.intent === "performance" &&
    (payload.swagger?.trim() || payload.postmanCollection?.trim())
  ) {
    try {
      const suite = await generatePerformanceSuite({
        inputType: payload.postmanCollection?.trim() ? "postman" : "openapi",
        swagger: payload.swagger,
        collection: payload.postmanCollection,
        projectId: payload.projectId,
        mode: "smoke",
        output: ["strategy", "k6"],
      });
      if (suite.strategy) {
        const json = JSON.stringify(suite.strategy, null, 2);
        assets.push({
          kind: "performance",
          title: "Load strategy",
          content: json,
          language: "json",
        });
        parts.push(`Performance smoke strategy JSON:\n${json.slice(0, 8000)}`);
      }
      if (suite.k6) {
        assets.push({
          kind: "performance",
          title: "k6 script",
          content: suite.k6,
          language: "javascript",
        });
        parts.push(`k6 starter script (first 4000 chars):\n${suite.k6.slice(0, 4000)}`);
      }
      warnings.push(...(suite.warnings ?? []));
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : String(e));
    }
  }

  return { text: parts.join("\n\n"), assets, warnings };
}

function chatSuggestions(
  route: RoutedIntent,
  message: string,
  payload: WorkspaceContextPayload
): string[] {
  const s: string[] = [];
  if (!payload.projectId) s.push("Select your active Katalon project in the context panel.");
  if (route.intent === "generate" || /\b(login|keyword|script|class|helper|page object)\b/i.test(message)) {
    s.push('Say what to build in chat — e.g. "create a page object for login" or paste test steps.');
    s.push("Include URL, locators, or step lines in your message when ready for Generated Groovy.");
  }
  if (route.intent === "analyze" || isProjectReviewRequest(message)) {
    s.push("Which module has the highest release risk?");
  }
  if (!payload.swagger && !payload.postmanCollection) {
    s.push("Attach Swagger or Postman JSON for API/performance depth.");
  }
  s.push("Review my project for risks and flaky tests");
  return [...new Set(s)].slice(0, 4);
}

/** Test Architect Chat — every message is Senior QA analysis first. */
export async function runWorkspaceAgent(
  route: RoutedIntent,
  message: string,
  ctx: EnrichedWorkspaceContext,
  req: WorkspaceChatRequest
): Promise<AgentRunResult> {
  const payload = ctx.payload;
  const token = req.authorizationToken;
  const model = req.model;

  route.agent = "qa_advisor";

  const supplementary = await gatherSupplementaryContext(route, message, payload);
  const task = buildSeniorQaUnifiedTask(
    message,
    route.intent,
    route.confidence,
    payload.platform ?? "web",
    payload,
    supplementary.text || undefined
  );

  const { response: qaResponse, model: m } = await seniorQaAnalysisReply(
    message,
    ctx,
    route,
    token,
    model,
    task
  );

  const steps = collectGenerationSteps(message, ctx.historyMessages ?? []);
  const chatPayload = enrichPayloadFromChat(message, ctx.historyMessages ?? [], payload);
  const generatedAssets = [...supplementary.assets];
  const warnings = [...supplementary.warnings];
  let response = qaResponse;
  let code: string | undefined;
  const actions: WorkspaceAction[] = [{ type: "advisory", label: "Senior QA analysis" }];

  if (wantsKatalonScriptGeneration(route, message, steps, chatPayload, ctx.historyMessages ?? [])) {
    const codeMode = resolveCodeGenerationMode(message, ctx.historyMessages ?? []);
    try {
      const orch = await runOrchestration({
        platform: chatPayload.platform ?? "web",
        prompt: message,
        steps,
        locators: chatPayload.locators,
        url: chatPayload.pageUrl,
        projectId: chatPayload.projectId,
        projectGenerationMode: chatPayload.projectGenerationMode,
        aiMemoryMode: chatPayload.aiMemoryMode,
        orchestrationMode: "advanced",
        authorizationToken: token,
        model,
        testCaseName: chatPayload.testCaseName,
        codeGenerationMode: codeMode,
        deterministicCompiler: true,
      });
      const groovy = orch.code?.trim() ?? "";
      if (groovy && !containsForbiddenPlaceholderCode(groovy)) {
        generatedAssets.push({
          kind: "groovy",
          title: groovyAssetTitle(codeMode),
          content: groovy,
          language: "groovy",
        });
        code = groovy;
        route.agent = "script_generator";
        actions.push({
          type: "generate",
          label: `Katalon ${codeMode === "auto" ? "script" : codeMode.replace(/_/g, " ")}`,
        });
        if (!response.includes("Generated Groovy")) {
          response += `\n\n---\n**Generated Katalon output** — same compiler as the Manual tab (**${codeMode.replace(/_/g, " ")}**). Review the **Generated Groovy** block below and copy into Katalon Studio.\n`;
        }
        if (orch.warnings?.length) warnings.push(...orch.warnings);
      } else if (groovy && containsForbiddenPlaceholderCode(groovy)) {
        warnings.push(
          "Script compiler produced placeholder steps — add clearer step lines in chat or the Context panel."
        );
      }
    } catch (e) {
      warnings.push(e instanceof Error ? e.message : String(e));
    }
  }

  return {
    response,
    actions,
    generatedAssets,
    suggestions: chatSuggestions(route, message, payload),
    model: m,
    warnings: warnings.length ? warnings : undefined,
    code,
  };
}
