import {
  detectCreateKeywordIntent,
  detectKeywordTemplatePlatform,
  KEYWORD_CREATE_CONFIDENCE_THRESHOLD,
  type CreateKeywordIntent,
} from "../testDsl/keywordCreateIntent.js";
import {
  buildSyntheticUtilityIntent,
  shouldWrapStepsForMode,
} from "../katalonCompiler/forcedOutputFromSteps.js";
import { inferKeywordSubjectFromSteps } from "../katalonCompiler/keywordFromTestSteps.js";
import {
  detectGroovyUtilityIntent,
  GROOVY_UTILITY_CONFIDENCE_THRESHOLD,
  looksLikeTestStepLine,
  type GroovyUtilityIntent,
} from "../testDsl/groovyUtilityIntent.js";
import {
  generateKeywordTemplateFromSteps,
  type KeywordTemplateGenerateResult,
} from "../katalonCompiler/keywordGenerationRouter.js";
import { generateForcedOutputFromSteps } from "../katalonCompiler/forcedOutputFromSteps.js";
import { compileGroovyUtility, type GroovyUtilityCompileResult } from "./groovyFunctionGenerator.js";
import { compileKatalonScript } from "../katalonCompiler/index.js";
import type { CompileKatalonInput, CompileKatalonResult } from "../katalonCompiler/types.js";
import { mergeHybridOutput } from "./groovyClassBuilder.js";

export type UserGenerationMode =
  | "auto"
  | "test_script"
  | "custom_keyword"
  | "groovy_function"
  | "utility_class"
  | "framework_helper"
  | "page_object"
  | "api_helper"
  | "db_utility"
  | "framework_service";

export type ResolvedGenerationMode =
  | "test_case"
  | "keyword_template"
  | "groovy_utility"
  | "hybrid"
  | "mixed_fallback"
  | "forced_wrap";

export interface GenerationModeAnalysis {
  mode: ResolvedGenerationMode;
  confidence: number;
  utilityIntents: GroovyUtilityIntent[];
  keywordIntent?: CreateKeywordIntent;
  /** User selected Custom keyword — compile steps into @Keyword method body */
  keywordFromSteps?: boolean;
  /** User-selected CODE OUTPUT — wrap compiled steps in that artifact type */
  forcedWrapMode?: UserGenerationMode;
  testStepLines: string[];
  utilityStepLines: string[];
}

function isUtilityModeHint(m: UserGenerationMode | undefined): boolean {
  return (
    m === "groovy_function" ||
    m === "utility_class" ||
    m === "framework_helper" ||
    m === "page_object" ||
    m === "api_helper" ||
    m === "db_utility" ||
    m === "framework_service"
  );
}

export function analyzeGenerationMode(
  steps: string[],
  userMode: UserGenerationMode = "auto"
): GenerationModeAnalysis {
  const trimmed = steps.map((s) => s.trim()).filter(Boolean);
  const empty: GenerationModeAnalysis = {
    mode: "test_case",
    confidence: 0,
    utilityIntents: [],
    testStepLines: trimmed,
    utilityStepLines: [],
  };
  if (trimmed.length === 0) return empty;

  const utilityIntents = trimmed
    .map((s) => detectGroovyUtilityIntent(s))
    .filter((u): u is GroovyUtilityIntent => u !== null && u.confidence >= GROOVY_UTILITY_CONFIDENCE_THRESHOLD);

  const keywordIntents = trimmed
    .map((s) => detectCreateKeywordIntent(s))
    .filter(
      (k): k is CreateKeywordIntent =>
        k !== null && k.confidence >= KEYWORD_CREATE_CONFIDENCE_THRESHOLD
    );

  const utilityLines = trimmed.filter((s) => detectGroovyUtilityIntent(s));
  const keywordLines = trimmed.filter((s) => detectCreateKeywordIntent(s));
  const testLines = trimmed.filter(
    (s) => !detectGroovyUtilityIntent(s) && !detectCreateKeywordIntent(s) && looksLikeTestStepLine(s)
  );
  const otherLines = trimmed.filter(
    (s) =>
      !detectGroovyUtilityIntent(s) &&
      !detectCreateKeywordIntent(s) &&
      !looksLikeTestStepLine(s)
  );

  if (userMode === "test_script") {
    return { ...empty, mode: "test_case", testStepLines: trimmed };
  }
  if (userMode === "custom_keyword") {
    const k = keywordIntents[0];
    if (k) {
      return {
        mode: "keyword_template",
        confidence: k.confidence,
        utilityIntents: [],
        keywordIntent: k,
        testStepLines: [],
        utilityStepLines: [],
      };
    }
    return {
      mode: "forced_wrap",
      confidence: 95,
      utilityIntents: [],
      forcedWrapMode: "custom_keyword",
      testStepLines: trimmed,
      utilityStepLines: [],
    };
  }
  if (isUtilityModeHint(userMode) || userMode === "groovy_function" || userMode === "utility_class") {
    if (shouldWrapStepsForMode(userMode, trimmed)) {
      return {
        mode: "forced_wrap",
        confidence: 95,
        utilityIntents: [],
        forcedWrapMode: userMode,
        testStepLines: trimmed,
        utilityStepLines: [],
      };
    }
    const intents =
      utilityIntents.length > 0
        ? utilityIntents
        : [buildSyntheticUtilityIntent(trimmed, userMode)];
    return {
      mode: "groovy_utility",
      confidence: intents[0]!.confidence,
      utilityIntents: intents,
      testStepLines: [],
      utilityStepLines: utilityLines.length ? utilityLines : trimmed,
    };
  }

  if (
    userMode === "page_object" ||
    userMode === "api_helper" ||
    userMode === "db_utility" ||
    userMode === "framework_service"
  ) {
    if (shouldWrapStepsForMode(userMode, trimmed)) {
      return {
        mode: "forced_wrap",
        confidence: 95,
        utilityIntents: [],
        forcedWrapMode: userMode,
        testStepLines: trimmed,
        utilityStepLines: [],
      };
    }
    return {
      mode: "groovy_utility",
      confidence: 95,
      utilityIntents: [buildSyntheticUtilityIntent(trimmed, userMode)],
      testStepLines: [],
      utilityStepLines: trimmed,
    };
  }

  const hasUtility = utilityIntents.length > 0;
  const hasKeyword = keywordIntents.length > 0;
  const hasTest =
    testLines.length > 0 ||
    otherLines.length > 0 ||
    (trimmed.length > 0 && !hasUtility && !hasKeyword);

  if (hasUtility && (hasTest || otherLines.length > 0) && trimmed.length > 1) {
    return {
      mode: "hybrid",
      confidence: utilityIntents[0]!.confidence,
      utilityIntents,
      testStepLines: [...testLines, ...otherLines],
      utilityStepLines: utilityLines.length ? utilityLines : trimmed.filter((s) => detectGroovyUtilityIntent(s)),
    };
  }

  if (hasUtility && !hasKeyword && utilityIntents.length === trimmed.length) {
    return {
      mode: "groovy_utility",
      confidence: utilityIntents.reduce((a, b) => Math.max(a, b.confidence), 0),
      utilityIntents,
      testStepLines: [],
      utilityStepLines: trimmed,
    };
  }

  if (hasUtility && !hasTest && utilityIntents.length >= 1 && trimmed.length === 1) {
    return {
      mode: "groovy_utility",
      confidence: utilityIntents[0]!.confidence,
      utilityIntents,
      testStepLines: [],
      utilityStepLines: trimmed,
    };
  }

  if (hasKeyword && !hasUtility && keywordIntents.length === trimmed.length) {
    return {
      mode: "keyword_template",
      confidence: keywordIntents[0]!.confidence,
      utilityIntents: [],
      keywordIntent: keywordIntents.reduce((best, cur) =>
        cur.confidence > best.confidence ? cur : best
      ),
      testStepLines: [],
      utilityStepLines: [],
    };
  }

  if ((hasUtility && hasKeyword) || (hasUtility && hasTest && utilityLines.length < trimmed.length)) {
    return {
      mode: "mixed_fallback",
      confidence: utilityIntents[0]?.confidence ?? 0,
      utilityIntents,
      keywordIntent: keywordIntents[0] ?? undefined,
      testStepLines: trimmed,
      utilityStepLines: utilityLines,
    };
  }

  if (hasUtility && trimmed.length === 1) {
    return {
      mode: "groovy_utility",
      confidence: utilityIntents[0]!.confidence,
      utilityIntents,
      testStepLines: [],
      utilityStepLines: trimmed,
    };
  }

  return { ...empty, testStepLines: trimmed };
}

export interface RoutedGenerateResult {
  handled: boolean;
  generationMode?: ResolvedGenerationMode;
  code?: string;
  model?: string;
  warnings?: string[];
  validationErrors?: string[];
  validationStage?: "groovy";
  keywordTemplate?: KeywordTemplateGenerateResult["keywordTemplate"];
  groovyUtility?: GroovyUtilityCompileResult["groovyUtility"];
}

export async function routeSpecializedGeneration(params: {
  steps: string[];
  userMode?: UserGenerationMode;
  platform: "web" | "mobile";
  authorizationToken?: string;
  model?: string;
  projectHint?: string;
  aiMemoryInjection?: string;
  projectKeywords?: import("../projectIntelligence/types.js").ParsedKeywordClass[];
  compileTestInput?: CompileKatalonInput;
}): Promise<RoutedGenerateResult> {
  const analysis = analyzeGenerationMode(params.steps, params.userMode ?? "auto");

  if (analysis.mode === "forced_wrap" && analysis.forcedWrapMode && params.compileTestInput) {
    const out = await generateForcedOutputFromSteps(
      analysis.forcedWrapMode,
      params.steps,
      params.compileTestInput,
      {
        authorizationToken: params.authorizationToken,
        model: params.model,
        projectHint: params.projectHint,
        aiMemoryInjection: params.aiMemoryInjection,
        projectKeywords: params.projectKeywords,
        forceDeterministic: !params.authorizationToken?.trim(),
      }
    );
    if (out) {
      return {
        handled: true,
        generationMode: out.generationMode,
        code: out.code,
        model: out.model,
        warnings: out.warnings,
        validationErrors: out.validationErrors,
        validationStage: out.validationErrors.length ? "groovy" : undefined,
        keywordTemplate: out.keywordTemplate,
        groovyUtility: out.groovyUtility,
      };
    }
  }

  if (analysis.mode === "keyword_template") {
    const kw = generateKeywordTemplateFromSteps(params.steps);
    if (kw) {
      return {
        handled: true,
        generationMode: "keyword_template",
        code: kw.code,
        model: kw.model,
        warnings: kw.warnings,
        validationErrors: kw.validationErrors,
        validationStage: kw.validationStage,
        keywordTemplate: kw.keywordTemplate,
      };
    }
  }

  if (analysis.mode === "groovy_utility" && analysis.utilityIntents.length > 0) {
    const intent = analysis.utilityIntents.reduce((a, b) =>
      b.confidence > a.confidence ? b : a
    );
    const compiled = await compileGroovyUtility(intent, {
      authorizationToken: params.authorizationToken,
      model: params.model,
      projectHint: params.projectHint,
      aiMemoryInjection: params.aiMemoryInjection,
      projectKeywords: params.projectKeywords,
    });
    return {
      handled: true,
      generationMode: "groovy_utility",
      code: compiled.code,
      model: compiled.model,
      warnings: compiled.warnings,
      validationErrors: compiled.validationErrors,
      validationStage: compiled.validationStage,
      groovyUtility: compiled.groovyUtility,
    };
  }

  if (analysis.mode === "hybrid" && analysis.utilityIntents.length > 0 && params.compileTestInput) {
    const intent = analysis.utilityIntents[0]!;
    const util = await compileGroovyUtility(intent, {
      authorizationToken: params.authorizationToken,
      model: params.model,
      projectHint: params.projectHint,
      aiMemoryInjection: params.aiMemoryInjection,
      projectKeywords: params.projectKeywords,
    });
    if (util.validationErrors.length > 0) {
      return {
        handled: true,
        generationMode: "hybrid",
        code: "",
        model: util.model,
        warnings: util.warnings,
        validationErrors: util.validationErrors,
        validationStage: util.validationStage,
      };
    }
    const testSteps = analysis.testStepLines.length ? analysis.testStepLines : params.steps;
    const testCompiled = compileKatalonScript({
      ...params.compileTestInput,
      steps: testSteps,
    });
    if (testCompiled.validationErrors.length > 0) {
      return {
        handled: true,
        generationMode: "hybrid",
        code: "",
        model: testCompiled.model,
        warnings: [...util.warnings, ...testCompiled.warnings],
        validationErrors: testCompiled.validationErrors,
        validationStage:
          testCompiled.validationStage === "groovy" ? "groovy" : undefined,
      };
    }
    return {
      handled: true,
      generationMode: "hybrid",
      code: mergeHybridOutput(util.code, testCompiled.code),
      model: `${util.model}+${testCompiled.model}`,
      warnings: [...util.warnings, ...testCompiled.warnings],
      validationErrors: [],
      groovyUtility: util.groovyUtility,
    };
  }

  return { handled: false };
}
