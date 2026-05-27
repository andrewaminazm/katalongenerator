import { isGosiBrainConfigured } from "../../../loadEnv.js";
import { gosiBrainGenerate, stripGosiBrainCoT } from "../../gosiBrain.js";
import { runOrchestration } from "../../aiOrchestrator/index.js";
import { buildSuggestions } from "../../aiOrchestrator/responseAssembler.js";
import { analyzeProjectV2 } from "../../projectIntelligenceV2/index.js";
import { generatePerformanceSuite } from "../../performanceEngine/index.js";
import type { EnrichedWorkspaceContext } from "../contextManager.js";
import { buildSystemContextBlock } from "../contextManager.js";
import type { RoutedIntent } from "../intentRouter.js";
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
        `**Advisory (offline)**\n\n${message}\n\nConfigure Gosi Brain on the server or pass an authorization token to enable full QA reasoning.`,
      model: "workspace-advisory",
    };
  }
  const prompt = `${buildSystemContextBlock(ctx)}

User request:
${message}

${extra ? `Task context:\n${extra}` : ""}

Respond in clear markdown. Include risks, best practices, and concrete next steps in this product (tabs: Manual, API Test, Performance, Project Intelligence).`;

  const { response, model: used } = await gosiBrainGenerate({
    prompt,
    authorizationToken: token,
    model,
    temperature: 0.5,
  });
  return { response: stripGosiBrainCoT(response), model: used };
}

export async function runWorkspaceAgent(
  route: RoutedIntent,
  message: string,
  ctx: EnrichedWorkspaceContext,
  req: WorkspaceChatRequest
): Promise<AgentRunResult> {
  const payload = ctx.payload;
  const platform = payload.platform ?? "web";
  const token = req.authorizationToken;
  const model = req.model;
  const steps =
    payload.steps?.length ? payload.steps : message.split(/\n/).map((s) => s.trim()).filter(Boolean);

  const actions: WorkspaceAction[] = [];
  const generatedAssets: WorkspaceGeneratedAsset[] = [];
  const warnings: string[] = [];

  switch (route.agent) {
    case "script_generator": {
      actions.push({ type: "orchestrate", label: "Ran script generation pipeline" });
      const orch = await runOrchestration({
        platform,
        prompt: message,
        steps,
        locators: payload.locators,
        url: payload.pageUrl,
        projectId: payload.projectId,
        projectGenerationMode: payload.projectGenerationMode,
        aiMemoryMode: payload.aiMemoryMode,
        orchestrationMode: "conversational",
        authorizationToken: token,
        model,
        testCaseName: payload.testCaseName,
      });
      if (orch.code?.trim()) {
        generatedAssets.push({
          kind: "groovy",
          title: "Generated Groovy",
          content: orch.code,
          language: "groovy",
        });
      }
      const narrative =
        orch.conversationalResponse?.trim() ||
        `Generated **${route.intent}** output using the deterministic compiler and orchestrator (${orch.orchestration.generatorsUsed.join(", ")}).`;
      return {
        response: narrative,
        actions,
        generatedAssets,
        suggestions: buildSuggestions(orch),
        code: orch.code,
        model: orch.model,
        warnings: [...warnings, ...orch.warnings],
      };
    }

    case "project_intelligence": {
      if (!payload.projectId) {
        const { response, model: m } = await advisoryReply(
          message,
          ctx,
          token,
          model,
          "User asked for project analysis but no projectId was set in workspace context."
        );
        return {
          response,
          actions: [{ type: "hint", label: "Set Active project ID in workspace context" }],
          generatedAssets,
          suggestions: ["Upload a project in Project Intelligence, then paste its ID in context."],
          model: m,
          warnings,
        };
      }
      actions.push({ type: "analyze", label: "Project Analyze v2" });
      const analysis = await analyzeProjectV2(payload.projectId, {
        healScripts: true,
        healLocators: true,
        generateDocumentation: true,
      });
      const md = analysis.documentation.markdown.slice(0, 12000);
      generatedAssets.push({
        kind: "report",
        title: "Project analysis summary",
        content: md,
        language: "markdown",
      });
      const summary = [
        `**Project Analyze** — risk **${analysis.insights.riskScore}/100**`,
        `- Script fixes (changed): ${analysis.fixes.testCases.filter((t) => t.changed).length}`,
        `- OR healing proposals: ${analysis.fixes.objectRepository.length}`,
        `- Flaky flags: ${analysis.insights.flakyTests.length}`,
        analysis.warnings.length ? `\nWarnings: ${analysis.warnings.join(" · ")}` : "",
      ].join("\n");
      return {
        response: summary,
        actions,
        generatedAssets,
        suggestions: [
          "Download PDF documentation from Project Intelligence.",
          "Click script rows to apply Groovy fixes.",
          "Click OR rows to heal locators with a Page URL.",
        ],
        warnings: analysis.warnings,
        model: "project-intelligence-v2",
      };
    }

    case "performance_agent": {
      if (payload.swagger?.trim() || payload.postmanCollection?.trim()) {
        actions.push({ type: "performance", label: "Generated performance suite" });
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
            generatedAssets.push({
              kind: "performance",
              title: "Load strategy",
              content: JSON.stringify(suite.strategy, null, 2),
              language: "json",
            });
          }
          if (suite.k6) {
            generatedAssets.push({
              kind: "performance",
              title: "k6 script",
              content: suite.k6,
              language: "javascript",
            });
          }
          return {
            response: `Created a **smoke** performance strategy and k6 starter script from your attached API definition. Review SLA hints in the strategy JSON before running load in QA.`,
            actions,
            generatedAssets,
            suggestions: [
              "Switch to Stress mode in Performance Test tab for full VU plans.",
              "Run k6 locally: k6 run script.js",
            ],
            model: "performance-engine",
            warnings: suite.warnings ?? [],
          };
        } catch (e) {
          warnings.push(e instanceof Error ? e.message : String(e));
        }
      }
      const { response, model: m } = await advisoryReply(
        message,
        ctx,
        token,
        model,
        "Performance Agent: attach Swagger or Postman JSON in workspace context, or use Performance Test tab."
      );
      return {
        response,
        actions,
        generatedAssets,
        suggestions: ["Open Performance Test tab with the same API input."],
        model: m,
        warnings,
      };
    }

    case "api_agent": {
      if (payload.swagger?.trim() || payload.postmanCollection?.trim()) {
        const { response, model: m } = await advisoryReply(
          message,
          ctx,
          token,
          model,
          "API Agent: use API Test tab to generate full Katalon + Postman artifacts from the attached spec. Summarize recommended folder structure, auth chaining, and assertion strategy."
        );
        actions.push({ type: "api", label: "API advisory with attached spec" });
        return {
          response,
          actions,
          generatedAssets,
          suggestions: [
            "Open API Test tab and paste the same Swagger/Postman.",
            "Enable project APIs if indexed.",
            "Generate negative payment scenarios?",
          ],
          model: m,
          warnings,
        };
      }
      const orch = await runOrchestration({
        platform: "web",
        prompt: message,
        steps,
        projectId: payload.projectId,
        orchestrationMode: "advanced",
        authorizationToken: token,
        model,
      });
      if (orch.code?.trim()) {
        generatedAssets.push({
          kind: "api",
          title: "API-related Groovy",
          content: orch.code,
          language: "groovy",
        });
      }
      return {
        response:
          orch.conversationalResponse ??
          "API-oriented generation complete. Paste Swagger/Postman in workspace context for full suite output.",
        actions: [{ type: "orchestrate", label: "API / orchestrator path" }],
        generatedAssets,
        suggestions: buildSuggestions(orch),
        code: orch.code,
        model: orch.model,
        warnings: orch.warnings,
      };
    }

    case "healing_agent": {
      const { response, model: m } = await advisoryReply(
        message,
        ctx,
        token,
        model,
        "Healing Agent: recommend locator strategy, OR cleanup, Playwright preview, and Project Intelligence OR row healing."
      );
      return {
        response,
        actions: [{ type: "heal", label: "Locator healing guidance" }],
        generatedAssets,
        suggestions: [
          "Click OR rows in Project Intelligence with a Page URL.",
          "Use Convert to Katalon locators before Generate.",
        ],
        model: m,
        warnings,
      };
    }

    case "review_agent": {
      const orch = await runOrchestration({
        platform,
        prompt: message,
        steps,
        projectId: payload.projectId,
        orchestrationMode: "architecture_review",
        authorizationToken: token,
        model,
      });
      return {
        response:
          orch.conversationalResponse ??
          "Architecture review complete. See generated artifacts and lint hints.",
        actions: [{ type: "review", label: "Architecture review" }],
        generatedAssets: orch.code
          ? [{ kind: "groovy", title: "Review output", content: orch.code, language: "groovy" }]
          : [],
        suggestions: buildSuggestions(orch),
        code: orch.code,
        model: orch.model,
        warnings: orch.warnings,
      };
    }

    case "documentation_agent": {
      if (payload.projectId) {
        const analysis = await analyzeProjectV2(payload.projectId, {
          healScripts: false,
          healLocators: false,
          generateDocumentation: true,
        });
        generatedAssets.push({
          kind: "markdown",
          title: "Project documentation",
          content: analysis.documentation.markdown,
          language: "markdown",
        });
        return {
          response: "Generated project documentation markdown from Project Analyze. Export PDF from Project Intelligence when ready.",
          actions: [{ type: "document", label: "Documentation generated" }],
          generatedAssets,
          suggestions: ["Download docs (PDF) in Project Intelligence."],
          model: "documentation-v2",
          warnings: [],
        };
      }
      const { response, model: m } = await advisoryReply(message, ctx, token, model);
      return {
        response,
        actions: [{ type: "document", label: "Documentation advisory" }],
        generatedAssets,
        suggestions: ["Open /how-to-use for product guides."],
        model: m,
        warnings,
      };
    }

    case "qa_advisor":
    default: {
      const { response, model: m } = await advisoryReply(message, ctx, token, model);
      return {
        response,
        actions: [{ type: "advisory", label: "QA architect advisory" }],
        generatedAssets,
        suggestions: relatedSuggestions(payload, route.intent),
        model: m,
        warnings,
      };
    }
  }
}

function relatedSuggestions(payload: WorkspaceContextPayload, intent: string): string[] {
  const s: string[] = [];
  if (!payload.projectId) s.push("Upload a Katalon project for project-aware generation.");
  if (intent === "explain") s.push("Paste execution logs in AI Failure Analyzer.");
  if (!payload.swagger && !payload.postmanCollection) {
    s.push("Attach Swagger or Postman JSON in workspace context for API/perf tasks.");
  }
  return s.slice(0, 4);
}
