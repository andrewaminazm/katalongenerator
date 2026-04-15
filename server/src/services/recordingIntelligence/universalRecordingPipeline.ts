/**
 * Universal Recording Fidelity Compiler — ordered stages (server-side).
 *
 * RAW RECORDING INPUT
 * → UNIVERSAL NORMALIZER (parsePlaywrightScriptToDsl / CSV / manual)
 * → ACTION PRESERVATION (preserveFullTrace: no parser dedupe)
 * → SELECTOR PRESERVATION (selectors on DSL context + locator lines)
 * → SEMANTIC OBJECT GENERATOR (buildRecordingTestObjectLabel)
 * → EXECUTION ORDER (strict sequence; optional intent completion when fidelity off)
 * → KATALON GROOVY GENERATOR (compileKatalonScript in /api/generate)
 * → FINAL VALIDATION (step count when lossless; selector binding: target label required, RHS mismatch non-blocking)
 */

import { parsePlaywrightScriptToDsl, type PlaywrightParseOptions } from "../playwrightActionParser.js";
import { runUniversalTestStepIntelligenceFromDsl } from "../testDsl/universalTestStepIntelligence.js";
import type { NormalizeResult } from "../testDsl/universalStepNormalizer.js";

export interface PlaywrightRecordingPipelineParams {
  platform: "web" | "mobile";
  /** When true: full trace parse + skip intent-completion inserts + strict step-count check. */
  preserveRecordingFidelity: boolean;
}

export function runPlaywrightRecordingPipeline(
  script: string,
  params: PlaywrightRecordingPipelineParams
): {
  parseOptions: PlaywrightParseOptions;
  pw: ReturnType<typeof parsePlaywrightScriptToDsl>;
  normalized: NormalizeResult | null;
} {
  const parseOptions: PlaywrightParseOptions = {
    preserveFullTrace: params.preserveRecordingFidelity,
  };
  const pw = parsePlaywrightScriptToDsl(script, parseOptions);
  // Partial parse is valid: recorder emits raw Playwright; unknown lines become parse errors but do not drop parsed steps.
  if (pw.dsl.length === 0) {
    return { parseOptions, pw, normalized: null };
  }
  const normalized = runUniversalTestStepIntelligenceFromDsl({
    dsl: pw.dsl,
    platform: params.platform,
    preserveRecordingFidelity: params.preserveRecordingFidelity,
  });
  return { parseOptions, pw, normalized };
}
