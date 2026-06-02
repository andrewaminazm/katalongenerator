import { gosiBrainGenerate, stripGosiBrainCoT } from "../gosiBrain.js";
import type { GroovyUtilityIntent } from "../testDsl/groovyUtilityIntent.js";
import { extractGroovyFromModelResponse, validateGroovyUtilityAst } from "./groovyAstValidator.js";
import { formatGroovyUtility } from "./groovyClassBuilder.js";

export const GROOVY_UTILITY_AI_MODEL_SUFFIX = "+ai";

function scoreEnterpriseGroovyUtility(code: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 100;

  const hasPackage = /^\s*package\s+\w[\w.]*\s*$/m.test(code);
  if (!hasPackage) {
    score -= 15;
    reasons.push("Missing package declaration");
  }

  const hasClass = /\bclass\s+[A-Z][A-Za-z0-9_]*\b/.test(code);
  if (!hasClass) {
    score -= 25;
    reasons.push("Missing class declaration");
  }

  if (/\bThread\.sleep\s*\(/.test(code)) {
    score -= 35;
    reasons.push("Forbidden: Thread.sleep()");
  }

  if (/\bRuntime\.getRuntime\(\)\.exec\s*\(|\bProcessBuilder\b/.test(code)) {
    score -= 45;
    reasons.push("Forbidden: Runtime.exec / ProcessBuilder");
  }

  // Minimum stability/diagnostics hygiene for enterprise helpers.
  const hasTryCatch = /\btry\s*\{[\s\S]*?\}\s*catch\s*\(/.test(code);
  const hasLog = /\bLoggerFactory\b|\blogger\.\w+\(|\bKeywordLogger\b|\bprintln\s*\(/.test(code);
  if (!hasTryCatch) {
    score -= 10;
    reasons.push("No try/catch for critical operations");
  }
  if (!hasLog) {
    score -= 8;
    reasons.push("No logging/diagnostics signal");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, reasons };
}

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

  return `# Gosi Brain Ultra Enterprise Groovy Generation Engine

You are a **Principal QA Automation Architect** and **Katalon Framework Engineer**.

PRIMARY OBJECTIVE:
- Generate ONE **production-grade** reusable Groovy class that can be committed to an enterprise repo.
- Never generate demo/tutorial code, pseudo code, placeholders, TODOs, or incomplete implementations.

INTELLIGENCE LAYERS (apply silently before writing code):
- Intent Analysis: infer best artifact shape for a reusable helper/utility/service/validator (no user choice).
- Framework Analysis: only import what is needed for ${intent.platform.toUpperCase()} (WebUI/Mobile/WS/pure Groovy).
- Enterprise Architecture: prefer encapsulation, reuse, and clean APIs; do not duplicate logic.
- Stability Intelligence: add smart waits (when applicable), retries (when valuable), exception handling, logging, and safe failure behavior.

ADVANCED KATALON STANDARDS (enforce):
- Forbidden: Thread.sleep(), raw Selenium, hardcoded waits, Runtime.exec, ProcessBuilder, TODO markers, weak validations.
- Prefer: FailureHandling, KeywordLogger (or equivalent), safe null handling, deterministic behavior.
- Locator priority: prefer Object Repository / findTestObject / project reuse; avoid XPath unless unavoidable.
- Wait strategy (web/mobile): use WebUI.waitForElementVisible/clickable, waitForPageLoad, waitForJQueryLoad, waitForAngularLoad where relevant.

OUTPUT RULES (critical):
- Output ONLY **compilable Groovy source code**. No markdown. No explanations.
- Use package common unless an API helper requires a more specific package.
- Class name PascalCase ending in Utils, Helper, Service, Validator, Manager, or Client as appropriate.
- Do NOT generate test cases (@Test), suites, or open/close browser flows.
- If a framework dependency is not necessary, keep it pure Groovy.

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

    const q = scoreEnterpriseGroovyUtility(code);
    if (q.score < 90) {
      return {
        code: "",
        model: `${model}${GROOVY_UTILITY_AI_MODEL_SUFFIX}`,
        warnings: [
          `AI output rejected: enterprise quality score ${q.score}/100 (<90)`,
          ...q.reasons.map((r) => `- ${r}`),
          ...v.warnings,
        ],
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
