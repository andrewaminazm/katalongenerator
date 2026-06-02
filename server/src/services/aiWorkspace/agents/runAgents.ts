import { isGosiBrainConfigured } from "../../../loadEnv.js";
import { gosiBrainGenerate, stripGosiBrainCoT } from "../../gosiBrain.js";
import { buildGosiBrainMessages } from "../gosiBrainPromptBuilder.js";
import { respondWithBuiltInIntelligence, generationConfirmationResponse } from "../builtInChatIntelligence.js";
import { analyzeProjectV2 } from "../../projectIntelligenceV2/index.js";
import { generatePerformanceSuite } from "../../performanceEngine/index.js";
import { runOrchestration } from "../../aiOrchestrator/index.js";
import type { EnrichedWorkspaceContext } from "../contextManager.js";
import type { RoutedIntent } from "../intentRouter.js";
import { isProjectReviewRequest } from "../intentRouter.js";
import {
  formatDetectedIntentBlock,
  containsForbiddenPlaceholderCode,
} from "../generationReadiness.js";
import {
  collectGenerationSteps,
  enrichPayloadFromChat,
  groovyAssetTitle,
  resolveCodeGenerationMode,
  wantsKatalonScriptGeneration,
} from "../workspaceScriptGeneration.js";
import { buildQaEvidencePack, evidenceGatherFlags } from "../qaEvidencePack.js";
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

/**
 * Call Gosi Brain with a proper system + history + user messages array,
 * adapted to the request type (generation / analysis / question / greeting).
 * Falls back to built-in intelligence if Gosi Brain is unavailable or fails.
 */
async function adaptiveGosiBrainReply(
  message: string,
  ctx: EnrichedWorkspaceContext,
  route: RoutedIntent,
  token: string | undefined,
  model: string | undefined,
  options: {
    willGenerate: boolean;
    supplementaryContext?: string;
  }
): Promise<{ response: string; model: string }> {
  if (isGosiBrainConfigured() && token?.trim()) {
    try {
      const messages = buildGosiBrainMessages({
        message,
        ctx,
        route,
        willGenerate: options.willGenerate,
        supplementaryContext: options.supplementaryContext,
      });

      const { response, model: used } = await gosiBrainGenerate({
        messages,
        authorizationToken: token,
        model,
        temperature: options.willGenerate ? 0.2 : 0.4,
      });
      return { response: stripGosiBrainCoT(response), model: used };
    } catch (err) {
      console.warn("[GosiBrain] Falling back to built-in intelligence:", err instanceof Error ? err.message : err);
      // Fall through to built-in intelligence
    }
  }

  // Built-in intelligence — works without any external LLM
  if (options.willGenerate) {
    return { response: generationConfirmationResponse(message), model: "built-in-qa-intelligence" };
  }
  return {
    response: respondWithBuiltInIntelligence(message, route.intent, route.confidence),
    model: "built-in-qa-intelligence",
  };
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
          `### Project Intelligence v2 (analyzer — use for dashboard evidence)`,
          `- Project risk score: ${analysis.insights.riskScore}/100 (source: project analyze)`,
          `- Flaky tests flagged: ${analysis.insights.flakyTests.length} (source: project analyze)`,
          `- Script fixes (changed): ${analysis.fixes.testCases.filter((t) => t.changed).length}`,
          `- OR healing proposals: ${analysis.fixes.objectRepository.length}`,
          analysis.insights.flakyTests.length
            ? `- Flaky sample: ${analysis.insights.flakyTests.slice(0, 6).join("; ")}`
            : "",
          analysis.warnings.length ? `- Warnings: ${analysis.warnings.join(" · ")}` : "",
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

/** Test Architect Chat — adaptive QA intelligence via Gosi Brain or built-in fallback. */
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

  // ── Step 1: Compute generation intent FIRST so Gosi Brain knows the context ──
  const steps = collectGenerationSteps(message, ctx.historyMessages ?? []);
  const chatPayload = enrichPayloadFromChat(message, ctx.historyMessages ?? [], payload);
  const willGenerate = wantsKatalonScriptGeneration(
    route,
    message,
    steps,
    chatPayload,
    ctx.historyMessages ?? []
  );

  // ── Step 2: Gather supplementary evidence (project analysis, perf suite etc.) ──
  const wantsProjectAnalysis =
    route.intent === "analyze" || isProjectReviewRequest(message);

  let evidenceFlags = evidenceGatherFlags(route, message, payload.projectId);
  if (wantsProjectAnalysis) {
    evidenceFlags = { ...evidenceFlags, includeProjectAnalyze: false };
  }
  const [supplementary, evidencePack] = await Promise.all([
    gatherSupplementaryContext(route, message, payload),
    buildQaEvidencePack({
      projectId: payload.projectId,
      swagger: payload.swagger,
      postmanCollection: payload.postmanCollection,
      route,
      message,
      ...evidenceFlags,
    }),
  ]);

  const combinedContext = [evidencePack, supplementary.text].filter(Boolean).join("\n\n");

  // ── Step 3: Call Gosi Brain (or built-in fallback) with full context ──
  const { response: rawResponse, model: m } = await adaptiveGosiBrainReply(
    message,
    ctx,
    route,
    token,
    model,
    {
      willGenerate,
      supplementaryContext: combinedContext || undefined,
    }
  );

  // ── Step 4: Tag response with detected intent block for the UI ──
  const intentBlock = formatDetectedIntentBlock(route.intent, route.confidence);
  let response = intentBlock ? `${intentBlock}\n\n${rawResponse}` : rawResponse;

  const generatedAssets = [...supplementary.assets];
  const warnings = [...supplementary.warnings];
  let code: string | undefined;
  const actions: WorkspaceAction[] = [{ type: "advisory", label: "QA analysis" }];

  // ── Step 5: Run Katalon compiler when user wants code ──
  if (willGenerate) {
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
        // Append artifact pointer only if the advisory didn't already mention it
        if (!response.includes("GENERATED ARTIFACTS") && !response.includes("Generated Groovy")) {
          response += `\n\n---\nKatalon **${codeMode.replace(/_/g, " ")}** generated — see the expandable Groovy block below. Copy into Katalon Studio after review.`;
        }
        if (orch.warnings?.length) warnings.push(...orch.warnings);
      } else if (groovy && containsForbiddenPlaceholderCode(groovy)) {
        warnings.push(
          "Script compiler produced placeholder steps — add clearer step lines in chat or use the Context panel to set URL and locators."
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
