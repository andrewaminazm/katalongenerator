import { gosiBrainGenerate, stripGosiBrainCoT } from "../gosiBrain.js";
import type { GroovyUtilityIntent } from "../testDsl/groovyUtilityIntent.js";
import { extractGroovyFromModelResponse, validateGroovyUtilityAst } from "./groovyAstValidator.js";
import { formatGroovyUtility } from "./groovyClassBuilder.js";

export const GROOVY_UTILITY_AI_MODEL_SUFFIX = "+ai";

function buildUtilityPrompt(intent: GroovyUtilityIntent, opts: { projectHint?: string; aiMemoryInjection?: string }): string {
  const projectHint = opts.projectHint;
  const platformGuide =
    intent.platform === "mobile"
      ? "Use MobileBuiltInKeywords where needed."
      : intent.platform === "api"
        ? "Use WSBuiltInKeywords and RequestObject."
        : intent.platform === "web"
          ? "Use WebUI and findTestObject for web helpers."
          : "Prefer pure Groovy with no Katalon dependency unless necessary.";

  return `You are a senior Katalon Groovy framework engineer. Generate ONE production-ready reusable Groovy class.

USER REQUEST: ${intent.raw}
TOPIC: ${intent.subject}
INTENT: ${intent.kind}
PLATFORM: ${intent.platform}
${platformGuide}

RULES:
- Output ONLY compilable Groovy source code. No markdown. No explanations.
- Use package common unless API helpers need another package.
- Class name PascalCase ending in Utils, Helper, Service, Validator, or Manager as appropriate.
- Include null-safety and try/catch only where needed.
- Do NOT use Runtime.exec, ProcessBuilder, or destructive OS commands.
- Do NOT generate test cases, @Test, WebUI.openBrowser, or verifyTextPresent.
- Use static methods for utilities unless @Keyword is explicitly needed for Katalon custom keywords.
${projectHint ? `\nPROJECT CONTEXT:\n${projectHint}` : ""}
${opts.aiMemoryInjection ? `\n${opts.aiMemoryInjection}` : ""}

Generate the complete class now.`;
}

export interface AiSynthesizeOptions {
  intent: GroovyUtilityIntent;
  model?: string;
  authorizationToken: string;
  projectHint?: string;
  aiMemoryInjection?: string;
}

export async function synthesizeGroovyUtilityWithAi(
  opts: AiSynthesizeOptions
): Promise<{ code: string; model: string; warnings: string[] } | null> {
  const url = process.env.GOSI_BRAIN_CHAT_URL?.trim();
  const apiKey = process.env.GOSI_BRAIN_API_KEY?.trim();
  if (!url || !apiKey) return null;

  try {
    const { response, model } = await gosiBrainGenerate({
      prompt: buildUtilityPrompt(opts.intent, {
        projectHint: opts.projectHint,
        aiMemoryInjection: opts.aiMemoryInjection,
      }),
      model: opts.model,
      authorizationToken: opts.authorizationToken,
      temperature: 0.2,
    });
    const stripped = stripGosiBrainCoT(response);
    const code = formatGroovyUtility(extractGroovyFromModelResponse(stripped));
    const v = validateGroovyUtilityAst(code);
    if (v.errors.length > 0) {
      return {
        code: "",
        model: `${model}${GROOVY_UTILITY_AI_MODEL_SUFFIX}`,
        warnings: [`AI output failed safety validation: ${v.errors.join("; ")}`],
      };
    }
    return {
      code,
      model: `${model}${GROOVY_UTILITY_AI_MODEL_SUFFIX}`,
      warnings: v.warnings,
    };
  } catch {
    return null;
  }
}
