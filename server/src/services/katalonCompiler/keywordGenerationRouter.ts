import {
  detectCreateKeywordIntent,
  KEYWORD_CREATE_CONFIDENCE_THRESHOLD,
  type CreateKeywordIntent,
} from "../testDsl/keywordCreateIntent.js";
import { compileKeywordTemplate, KEYWORD_TEMPLATE_MODEL_ID } from "./keywordTemplateGenerator.js";
import { validateKeywordTemplateGroovy } from "./validationLayer.js";

export type GenerationRouteMode = "keyword_template" | "test_case" | "mixed_fallback";

export interface KeywordGenerationAnalysis {
  mode: GenerationRouteMode;
  /** Set when mode === keyword_template */
  intent?: CreateKeywordIntent;
  confidence: number;
}

/**
 * Decide whether steps request a Custom Keyword class (not a test script).
 * Mixed keyword-create + normal steps → test_case (deterministic compiler).
 */
export function analyzeKeywordGenerationRequest(steps: string[]): KeywordGenerationAnalysis {
  const trimmed = steps.map((s) => s.trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return { mode: "test_case", confidence: 0 };
  }

  const detected = trimmed.map((s) => detectCreateKeywordIntent(s));
  const keywordSteps = detected.filter(
    (d): d is CreateKeywordIntent => d !== null && d.confidence >= KEYWORD_CREATE_CONFIDENCE_THRESHOLD
  );

  if (keywordSteps.length === 0) {
    return { mode: "test_case", confidence: 0 };
  }

  if (trimmed.length > 1 && keywordSteps.length < trimmed.length) {
    return { mode: "mixed_fallback", confidence: keywordSteps[0]!.confidence };
  }

  const best = keywordSteps.reduce((a, b) => (b.confidence > a.confidence ? b : a));
  return { mode: "keyword_template", intent: best, confidence: best.confidence };
}

export interface KeywordTemplateGenerateResult {
  code: string;
  model: string;
  warnings: string[];
  validationErrors: string[];
  validationStage?: "groovy";
  generationMode: "keyword_template";
  keywordTemplate: {
    className: string;
    methodName: string;
    platform: CreateKeywordIntent["platform"];
    confidence: number;
  };
}

export function generateKeywordTemplateFromSteps(steps: string[]): KeywordTemplateGenerateResult | null {
  const analysis = analyzeKeywordGenerationRequest(steps);
  if (analysis.mode !== "keyword_template" || !analysis.intent) {
    return null;
  }

  const compiled = compileKeywordTemplate(analysis.intent);
  const v = validateKeywordTemplateGroovy(compiled.code);
  if (v.errors.length > 0) {
    return {
      code: "",
      model: KEYWORD_TEMPLATE_MODEL_ID,
      warnings: [...compiled.warnings, ...v.warnings],
      validationErrors: v.errors,
      validationStage: "groovy",
      generationMode: "keyword_template",
      keywordTemplate: {
        className: compiled.className,
        methodName: compiled.methodName,
        platform: compiled.platform,
        confidence: analysis.confidence,
      },
    };
  }

  return {
    code: compiled.code,
    model: compiled.model,
    warnings: [...compiled.warnings, ...v.warnings],
    validationErrors: [],
    generationMode: "keyword_template",
    keywordTemplate: {
      className: compiled.className,
      methodName: compiled.methodName,
      platform: compiled.platform,
      confidence: analysis.confidence,
    },
  };
}
