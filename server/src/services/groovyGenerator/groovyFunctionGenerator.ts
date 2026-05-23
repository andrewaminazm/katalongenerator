import type { GroovyUtilityIntent } from "../testDsl/groovyUtilityIntent.js";
import type { ParsedKeywordClass } from "../projectIntelligence/types.js";
import { compileArchitectureGroovy } from "../groovyArchitecture/groovyFunctionGenerator.js";
import { validateGroovyUtilityAst } from "./groovyAstValidator.js";
import { buildUtilityMetadata, formatGroovyUtility } from "./groovyClassBuilder.js";
import { inferMethodName, inferUtilityClassName } from "./groovyBestPractices.js";
import { synthesizeGroovyUtilityWithAi } from "./groovyAiSynthesizer.js";
import { matchDeterministicTemplate, renderGenericUtility, renderTemplate } from "./groovyTemplateEngine.js";

export const GROOVY_UTILITY_MODEL_ID = "katalon-groovy-utility-v1";

export interface CompileGroovyUtilityOptions {
  /** Prefer AI synthesis when server + token available */
  authorizationToken?: string;
  model?: string;
  projectHint?: string;
  aiMemoryInjection?: string;
  forceDeterministic?: boolean;
  projectKeywords?: ParsedKeywordClass[];
}

export interface GroovyUtilityCompileResult {
  code: string;
  model: string;
  warnings: string[];
  validationErrors: string[];
  validationStage?: "groovy";
  generationMode: "groovy_utility";
  groovyUtility: {
    className: string;
    methodName: string;
    platform: GroovyUtilityIntent["platform"];
    kind: GroovyUtilityIntent["kind"];
    confidence: number;
    subject: string;
    synthesizedBy: "template" | "generic" | "ai" | "architecture";
  };
  architecture?: {
    componentKind?: string;
    features?: Record<string, boolean>;
    buildersUsed?: string[];
  };
}

export async function compileGroovyUtility(
  intent: GroovyUtilityIntent,
  opts: CompileGroovyUtilityOptions = {}
): Promise<GroovyUtilityCompileResult> {
  const arch = await compileArchitectureGroovy(intent.raw, {
    authorizationToken: opts.authorizationToken,
    model: opts.model,
    projectHint: opts.projectHint,
    aiMemoryInjection: opts.aiMemoryInjection,
    forceDeterministic: opts.forceDeterministic,
    projectKeywords: opts.projectKeywords,
  });
  if (arch?.code && arch.validationErrors.length === 0) {
    return {
      code: arch.code,
      model: arch.model,
      warnings: arch.warnings,
      validationErrors: [],
      generationMode: "groovy_utility",
      groovyUtility: {
        className: arch.className,
        methodName: arch.methodName,
        platform: intent.platform,
        kind: intent.kind,
        confidence: intent.confidence,
        subject: intent.subject,
        synthesizedBy: arch.synthesizedBy === "architecture" ? "architecture" : arch.synthesizedBy,
      },
      architecture: arch.architecture,
    };
  }

  const warnings: string[] = arch?.warnings ?? [];
  let code = "";
  let synthesizedBy: "template" | "generic" | "ai" = "generic";
  let model = GROOVY_UTILITY_MODEL_ID;

  const template = matchDeterministicTemplate(intent);
  const useAi =
    !opts.forceDeterministic &&
    Boolean(opts.authorizationToken?.trim()) &&
    (!template || intent.confidence < 85);

  if (useAi && opts.authorizationToken) {
    const ai = await synthesizeGroovyUtilityWithAi({
      intent,
      authorizationToken: opts.authorizationToken,
      model: opts.model,
      projectHint: opts.projectHint,
      aiMemoryInjection: opts.aiMemoryInjection,
    });
    if (ai?.code) {
      code = ai.code;
      model = ai.model;
      synthesizedBy = "ai";
      warnings.push(...ai.warnings);
    }
  }

  if (!code) {
    if (template?.matched) {
      code = renderTemplate(template, intent);
      synthesizedBy = "template";
    } else {
      code = renderGenericUtility(intent);
      synthesizedBy = "generic";
      warnings.push(
        "No specialized template matched — generic stub generated. Refine the request or enable AI for richer output."
      );
    }
    code = formatGroovyUtility(code);
  }

  const v = validateGroovyUtilityAst(code);
  const className = (code.match(/\bclass\s+([A-Z]\w*)/) ?? [])[1] ?? inferUtilityClassName(intent.subject);
  const methodMatch = code.match(/(?:static\s+)?(?:def\s+)?(\w+)\s*\([^)]*\)\s*\{/);
  const methodName = methodMatch?.[1] ?? inferMethodName(intent.subject);

  if (v.errors.length > 0) {
    return {
      code: "",
      model,
      warnings: [...warnings, ...v.warnings],
      validationErrors: v.errors,
      validationStage: "groovy",
      generationMode: "groovy_utility",
      groovyUtility: {
        ...buildUtilityMetadata(intent, className, methodName),
        synthesizedBy,
      },
    };
  }

  return {
    code,
    model,
    warnings: [...warnings, ...v.warnings],
    validationErrors: [],
    generationMode: "groovy_utility",
    groovyUtility: {
      ...buildUtilityMetadata(intent, className, methodName),
      synthesizedBy,
    },
  };
}
