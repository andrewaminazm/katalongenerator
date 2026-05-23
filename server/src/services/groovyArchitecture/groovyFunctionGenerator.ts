import { validateGroovyUtilityAst } from "../groovyGenerator/groovyAstValidator.js";
import { formatGroovyUtility, buildUtilityMetadata } from "../groovyGenerator/groovyClassBuilder.js";
import { inferMethodName } from "../groovyGenerator/groovyBestPractices.js";
import { synthesizeGroovyUtilityWithAi } from "../groovyGenerator/groovyAiSynthesizer.js";
import {
  matchDeterministicTemplate,
  renderGenericUtility,
  renderTemplate,
} from "../groovyGenerator/groovyTemplateEngine.js";
import { analyzeArchitecturePrompt, inferArchitectureClassName } from "./architectureIntentAnalyzer.js";
import { buildApiHelper } from "./apiHelperGenerator.js";
import { buildDatabaseUtility } from "./databaseUtilityGenerator.js";
import { buildFrameworkService } from "./frameworkServiceGenerator.js";
import { buildPageObject } from "./pageObjectGenerator.js";
import { buildReusableHelper } from "./reusableHelperBuilder.js";
import { scanProjectReuse } from "./projectReuseScanner.js";
import type { ArchitectureBuildResult, ArchitecturePlan } from "./types.js";
import type { ParsedKeywordClass } from "../projectIntelligence/types.js";

export const ARCHITECTURE_MODEL_ID = "katalon-groovy-architecture-v1";

export interface CompileArchitectureOptions {
  authorizationToken?: string;
  model?: string;
  projectHint?: string;
  aiMemoryInjection?: string;
  forceDeterministic?: boolean;
  projectKeywords?: ParsedKeywordClass[];
}

function buildPlan(
  intent: NonNullable<ReturnType<typeof analyzeArchitecturePrompt>>,
  projectKeywords?: ParsedKeywordClass[]
): ArchitecturePlan {
  return {
    intent,
    className: inferArchitectureClassName(intent.kind, intent.subject),
    primaryMethod: inferMethodName(intent.subject),
    packageName: "common",
    projectReuse: scanProjectReuse(projectKeywords),
  };
}

function routeBuilder(plan: ArchitecturePlan): { code: string; buildersUsed: string[] } | null {
  switch (plan.intent.kind) {
    case "reusable_helper":
      return buildReusableHelper(plan);
    case "page_object":
      return buildPageObject(plan);
    case "api_helper":
      return buildApiHelper(plan);
    case "db_utility":
      return buildDatabaseUtility(plan);
    case "framework_service":
      return buildFrameworkService(plan);
    default:
      return null;
  }
}

async function legacyUtilityFallback(
  plan: ArchitecturePlan,
  opts: CompileArchitectureOptions
): Promise<ArchitectureBuildResult> {
  const intent = plan.intent.utilityIntent;
  const warnings: string[] = [];
  let code = "";
  let synthesizedBy: "template" | "generic" | "ai" = "generic";
  let model = ARCHITECTURE_MODEL_ID;

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
      warnings.push("No specialized template matched — refine the prompt or enable Gosi Brain.");
    }
    code = formatGroovyUtility(code);
  }

  const v = validateGroovyUtilityAst(code);
  const meta = buildUtilityMetadata(intent, plan.className, plan.primaryMethod);

  return {
    code: v.errors.length > 0 ? "" : code,
    model,
    warnings,
    validationErrors: v.errors,
    validationStage: v.errors.length > 0 ? "groovy" : undefined,
    componentKind: plan.intent.kind,
    className: meta.className,
    methodName: meta.methodName,
    synthesizedBy,
    architecture: { features: plan.intent.features, buildersUsed: ["legacyTemplate"] },
  };
}

/**
 * Enterprise Groovy architecture generator — helpers, page objects, API/DB services.
 */
export async function compileArchitectureGroovy(
  raw: string,
  opts: CompileArchitectureOptions = {}
): Promise<ArchitectureBuildResult | null> {
  const intent = analyzeArchitecturePrompt(raw);
  if (!intent) return null;

  const plan = buildPlan(intent, opts.projectKeywords);
  const warnings: string[] = [];

  const useAi =
    !opts.forceDeterministic &&
    Boolean(opts.authorizationToken?.trim()) &&
    intent.kind === "generic_utility";

  if (useAi && opts.authorizationToken) {
    const ai = await synthesizeGroovyUtilityWithAi({
      intent: intent.utilityIntent,
      authorizationToken: opts.authorizationToken,
      model: opts.model,
      projectHint: [
        opts.projectHint,
        `Architecture kind: ${intent.kind}`,
        `Features: retry=${intent.features.retry}, screenshot=${intent.features.screenshot}, session=${intent.features.sessionValidation}`,
        opts.aiMemoryInjection,
      ]
        .filter(Boolean)
        .join("\n"),
      aiMemoryInjection: opts.aiMemoryInjection,
    });
    if (ai?.code) {
      const v = validateGroovyUtilityAst(ai.code);
      if (v.errors.length === 0) {
        return {
          code: formatGroovyUtility(ai.code),
          model: ai.model,
          warnings: [...warnings, ...ai.warnings],
          validationErrors: [],
          componentKind: intent.kind,
          className: plan.className,
          methodName: plan.primaryMethod,
          synthesizedBy: "ai",
          architecture: { features: intent.features, buildersUsed: ["groovyAiSynthesizer"] },
        };
      }
      warnings.push(`AI architecture output rejected: ${v.errors.join("; ")}`);
    }
  }

  const built = routeBuilder(plan);
  if (built) {
    const code = formatGroovyUtility(built.code);
    const v = validateGroovyUtilityAst(code);
    if (v.errors.length === 0) {
      if (plan.projectReuse.retryHelper) {
        warnings.push(`Reusing project retry helper: ${plan.projectReuse.retryHelper}`);
      }
      return {
        code,
        model: ARCHITECTURE_MODEL_ID,
        warnings: [...warnings, ...v.warnings],
        validationErrors: [],
        componentKind: intent.kind,
        className: plan.className,
        methodName: plan.primaryMethod,
        synthesizedBy: "architecture",
        architecture: { features: intent.features, buildersUsed: built.buildersUsed },
      };
    }
    warnings.push(`Architecture builder validation failed: ${v.errors.join("; ")}`);
  }

  return legacyUtilityFallback(plan, opts);
}

export function shouldUseArchitectureGenerator(raw: string): boolean {
  return analyzeArchitecturePrompt(raw) !== null;
}
