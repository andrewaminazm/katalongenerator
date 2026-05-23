import type { UserGenerationMode } from "../groovyGenerator/generationModeRouter.js";
import { inferArchitectureClassName } from "../groovyArchitecture/architectureIntentAnalyzer.js";
import { compileArchitectureGroovy, ARCHITECTURE_MODEL_ID } from "../groovyArchitecture/groovyFunctionGenerator.js";
import { wrapGroovyClass } from "../groovyArchitecture/architectureTemplateEngine.js";
import { resolveUtilityImports } from "../groovyGenerator/groovyImportResolver.js";
import { inferUtilityClassName } from "../groovyGenerator/groovyBestPractices.js";
import { validateGroovyUtilityAst } from "../groovyGenerator/groovyAstValidator.js";
import type { GroovyUtilityCompileResult } from "../groovyGenerator/groovyFunctionGenerator.js";
import type { CompileKatalonInput } from "./types.js";
import { compileKatalonScript } from "./index.js";
import {
  extractKeywordBodyLines,
  generateKeywordClassFromTestSteps,
  inferKeywordMethodNameFromSteps,
  inferKeywordSubjectFromSteps,
  keywordImportsForBody,
  wrapBodyAsKeywordClass,
  type KeywordFromStepsResult,
} from "./keywordFromTestSteps.js";
import { looksLikeTestStepLine } from "../testDsl/groovyUtilityIntent.js";
import {
  classifyGroovyUtilityKind,
  detectGroovyUtilityIntent,
  detectGroovyUtilityPlatform,
  type GroovyUtilityIntent,
} from "../testDsl/groovyUtilityIntent.js";
import { detectCreateKeywordIntent } from "../testDsl/keywordCreateIntent.js";
import { KEYWORD_TEMPLATE_MODEL_ID } from "./keywordTemplateGenerator.js";
import { validateKeywordTemplateGroovy } from "./validationLayer.js";

export { inferKeywordSubjectFromSteps as inferSubjectFromSteps };

const ARCHITECTURE_MODES: UserGenerationMode[] = [
  "page_object",
  "api_helper",
  "db_utility",
  "framework_service",
  "framework_helper",
];

const UTILITY_WRAP_MODES: UserGenerationMode[] = [
  "groovy_function",
  "utility_class",
  "framework_helper",
];

export function isExplicitCodeOutputMode(mode: UserGenerationMode): boolean {
  return mode !== "auto" && mode !== "test_script";
}

export function shouldWrapStepsForMode(mode: UserGenerationMode, steps: string[]): boolean {
  if (!isExplicitCodeOutputMode(mode)) return false;
  if (mode === "custom_keyword" && steps.some((s) => detectCreateKeywordIntent(s))) {
    return false;
  }
  if (
    (mode === "groovy_function" || mode === "utility_class") &&
    steps.some((s) => detectGroovyUtilityIntent(s))
  ) {
    return false;
  }
  if (ARCHITECTURE_MODES.includes(mode) && steps.length === 1) {
    const raw = steps[0]!.toLowerCase();
    if (/\b(create|generate|make|build)\b/.test(raw)) return false;
  }
  return steps.some((s) => looksLikeTestStepLine(s));
}

export function architecturePromptForMode(
  mode: UserGenerationMode,
  subject: string
): string | null {
  switch (mode) {
    case "page_object":
      return `create page object for ${subject}`;
    case "api_helper":
      return `create api helper for ${subject}`;
    case "db_utility":
      return `create db utility for ${subject}`;
    case "framework_service":
      return `create framework service for ${subject}`;
    case "framework_helper":
      return `create reusable ${subject} helper`;
    case "groovy_function":
      return `create groovy function for ${subject}`;
    case "utility_class":
      return `create utility class for ${subject}`;
    default:
      return null;
  }
}

export function buildSyntheticUtilityIntent(
  steps: string[],
  mode: UserGenerationMode,
  testCaseName?: string
): GroovyUtilityIntent {
  const subject = inferKeywordSubjectFromSteps(steps, testCaseName);
  const prompt = architecturePromptForMode(mode, subject) ?? steps.join("\n");
  return {
    raw: prompt,
    confidence: 95,
    kind: classifyGroovyUtilityKind(prompt),
    subject,
    platform: detectGroovyUtilityPlatform(prompt + " " + steps.join(" ")),
  };
}

function classNameForWrapMode(mode: UserGenerationMode, subject: string): string {
  switch (mode) {
    case "page_object":
      return inferArchitectureClassName("page_object", subject);
    case "api_helper":
      return inferArchitectureClassName("api_helper", subject);
    case "db_utility":
      return inferArchitectureClassName("db_utility", subject);
    case "framework_service":
      return inferArchitectureClassName("framework_service", subject);
    case "framework_helper":
      return inferArchitectureClassName("reusable_helper", subject);
    default:
      return inferUtilityClassName(subject);
  }
}

function wrapBodyAsUtilityLikeClass(options: {
  mode: UserGenerationMode;
  subject: string;
  platform: "web" | "mobile";
  bodyLines: string[];
  methodName: string;
}): string {
  const className = classNameForWrapMode(options.mode, options.subject);
  const imports = keywordImportsForBody(
    options.platform === "mobile" ? "mobile" : "web",
    options.bodyLines
  ).filter((l) => !l.includes("@Keyword"));

  const indented = options.bodyLines
    .map((line) => (line.trim() ? `        ${line.trim()}` : ""))
    .filter(Boolean);

  return wrapGroovyClass({
    className,
    imports,
    bodyLines: [`    static void ${options.methodName}() {`, "", ...indented, "    }"],
  });
}

function wrapBodyAsPageObject(options: {
  subject: string;
  bodyLines: string[];
  methodName: string;
}): string {
  const className = inferArchitectureClassName("page_object", options.subject);
  const imports = resolveUtilityImports("web", { webui: true, testObject: true });
  const indented = options.bodyLines
    .map((line) => (line.trim() ? `        ${line.trim()}` : ""))
    .filter(Boolean);

  return wrapGroovyClass({
    className,
    imports,
    bodyLines: [`    static void ${options.methodName}() {`, "", ...indented, "    }"],
  });
}

export interface ForcedOutputResult {
  code: string;
  model: string;
  warnings: string[];
  validationErrors: string[];
  generationMode: "keyword_template" | "groovy_utility";
  keywordTemplate?: KeywordFromStepsResult["keywordTemplate"];
  groovyUtility?: GroovyUtilityCompileResult["groovyUtility"];
}

export interface ForcedOutputOptions {
  authorizationToken?: string;
  model?: string;
  projectHint?: string;
  aiMemoryInjection?: string;
  projectKeywords?: import("../projectIntelligence/types.js").ParsedKeywordClass[];
  forceDeterministic?: boolean;
}

export async function generateForcedOutputFromSteps(
  userMode: UserGenerationMode,
  steps: string[],
  compileInput: CompileKatalonInput,
  opts: ForcedOutputOptions = {}
): Promise<ForcedOutputResult | null> {
  const trimmed = steps.map((s) => s.trim()).filter(Boolean);
  if (trimmed.length === 0) return null;

  if (userMode === "custom_keyword") {
    const kw = generateKeywordClassFromTestSteps(trimmed, compileInput);
    if (!kw) return null;
    return { ...kw, groovyUtility: undefined };
  }

  const subject = inferKeywordSubjectFromSteps(trimmed, compileInput.testCaseName);
  const methodName = inferKeywordMethodNameFromSteps(trimmed, subject);
  const platform = compileInput.platform;
  const prompt = architecturePromptForMode(userMode, subject);

  if (
    ARCHITECTURE_MODES.includes(userMode) &&
    !shouldWrapStepsForMode(userMode, trimmed) &&
    prompt
  ) {
    const arch = await compileArchitectureGroovy(
      trimmed.length === 1 && /\b(create|generate)\b/i.test(trimmed[0]!) ? trimmed[0]! : prompt,
      {
        authorizationToken: opts.authorizationToken,
        model: opts.model,
        projectHint: opts.projectHint,
        aiMemoryInjection: opts.aiMemoryInjection,
        forceDeterministic: opts.forceDeterministic,
        projectKeywords: opts.projectKeywords,
      }
    );
    if (!arch) return null;
    return {
      code: arch.code,
      model: arch.model,
      warnings: [
        ...arch.warnings,
        `Generated ${userMode.replace(/_/g, " ")} from CODE OUTPUT selection.`,
      ],
      validationErrors: arch.validationErrors,
      generationMode: "groovy_utility",
      groovyUtility: {
        className: arch.className,
        methodName: arch.methodName,
        platform: userMode === "api_helper" ? "api" : "web",
        kind: "generateFrameworkComponent",
        confidence: 95,
        subject,
        synthesizedBy: "architecture",
      },
    };
  }

  const compiled = compileKatalonScript({ ...compileInput, steps: trimmed });
  if (compiled.validationErrors.length > 0 || !compiled.code.trim()) {
    return {
      code: "",
      model: KEYWORD_TEMPLATE_MODEL_ID,
      warnings: compiled.warnings,
      validationErrors: compiled.validationErrors,
      generationMode: "groovy_utility",
      groovyUtility: {
        className: classNameForWrapMode(userMode, subject),
        methodName,
        platform: platform === "mobile" ? "mobile" : "web",
        kind: "generateHelper",
        confidence: 0,
        subject,
        synthesizedBy: "architecture",
      },
    };
  }

  const bodyLines = extractKeywordBodyLines(compiled.code);
  if (bodyLines.length === 0) {
    return {
      code: "",
      model: KEYWORD_TEMPLATE_MODEL_ID,
      warnings: ["No actions could be extracted from steps."],
      validationErrors: ["Output body is empty after compiling steps."],
      generationMode: "groovy_utility",
      groovyUtility: {
        className: classNameForWrapMode(userMode, subject),
        methodName,
        platform: "web",
        kind: "generateHelper",
        confidence: 0,
        subject,
        synthesizedBy: "architecture",
      },
    };
  }

  let code: string;
  let wrappedAsKeyword = false;
  if (userMode === "page_object") {
    code = wrapBodyAsPageObject({ subject, bodyLines, methodName });
  } else if (
    UTILITY_WRAP_MODES.includes(userMode) ||
    userMode === "groovy_function" ||
    userMode === "utility_class"
  ) {
    code = wrapBodyAsUtilityLikeClass({
      mode: userMode,
      subject,
      platform,
      bodyLines,
      methodName,
    });
  } else if (ARCHITECTURE_MODES.includes(userMode) && prompt) {
    const arch = await compileArchitectureGroovy(prompt, {
      authorizationToken: opts.authorizationToken,
      model: opts.model,
      projectHint: opts.projectHint,
      aiMemoryInjection: opts.aiMemoryInjection,
      forceDeterministic: opts.forceDeterministic ?? true,
      projectKeywords: opts.projectKeywords,
    });
    if (arch?.code && arch.validationErrors.length === 0) {
      return {
        code: arch.code,
        model: arch.model,
        warnings: [
          ...compiled.warnings,
          ...arch.warnings,
          `CODE OUTPUT is ${userMode.replace(/_/g, " ")} — scaffold generated (steps look like a web flow).`,
        ],
        validationErrors: [],
        generationMode: "groovy_utility",
        groovyUtility: {
          className: arch.className,
          methodName: arch.methodName,
          platform: "web",
          kind: "generateFrameworkComponent",
          confidence: 95,
          subject,
          synthesizedBy: "architecture",
        },
      };
    }
    code = wrapBodyAsUtilityLikeClass({
      mode: userMode,
      subject,
      platform,
      bodyLines,
      methodName,
    });
  } else {
    code = wrapBodyAsKeywordClass({
      subject,
      platform: platform === "mobile" ? "mobile" : "web",
      bodyLines,
      methodName,
    });
    wrappedAsKeyword = true;
  }

  const className = classNameForWrapMode(userMode, subject);
  const isKeyword = wrappedAsKeyword;
  const v = isKeyword
    ? validateKeywordTemplateGroovy(code, { allowOpenBrowser: true })
    : validateGroovyUtilityAst(code);

  return {
    code: v.errors.length > 0 ? "" : code,
    model: isKeyword ? KEYWORD_TEMPLATE_MODEL_ID : ARCHITECTURE_MODEL_ID,
    warnings: [
      ...compiled.warnings,
      ...v.warnings,
      `Wrapped compiled test steps as ${userMode.replace(/_/g, " ")} (${className}.${methodName}()).`,
    ],
    validationErrors: v.errors,
    generationMode: isKeyword ? "keyword_template" : "groovy_utility",
    ...(isKeyword
      ? {
          keywordTemplate: {
            className,
            methodName,
            platform: platform === "mobile" ? "mobile" : "web",
            confidence: 95,
          },
        }
      : {
          groovyUtility: {
            className,
            methodName,
            platform: platform === "mobile" ? "mobile" : "web",
            kind: "generateHelper",
            confidence: 95,
            subject,
            synthesizedBy: "architecture",
          },
        }),
  };
}
