/**
 * Final “no silent loss” check between recorded action count and emitted DSL / step count.
 */

export interface RecordingFidelityReport {
  ok: boolean;
  recordedActions: number;
  dslSteps: number;
  message?: string;
}

export function compareRecordingToDslSteps(
  recordedActions: number,
  dslSteps: number
): RecordingFidelityReport {
  if (recordedActions <= 0) {
    return { ok: true, recordedActions, dslSteps };
  }
  /** More DSL steps than raw parse is OK (e.g. intent completion adds submit). Fewer is a loss. */
  if (dslSteps >= recordedActions) {
    return { ok: true, recordedActions, dslSteps };
  }
  return {
    ok: false,
    recordedActions,
    dslSteps,
    message: `Recording fidelity: ${recordedActions} recorded actions parsed but only ${dslSteps} DSL steps (possible silent loss).`,
  };
}

/**
 * Lossless replay mode: normalized step count must equal parsed Playwright action count
 * (no intent-completion inserts, no parser dedupe).
 */
export function validateStrictRecordingFidelity(
  recordedActionCount: number,
  emittedStepCount: number
): { ok: boolean; message?: string } {
  if (recordedActionCount <= 0) return { ok: true };
  if (emittedStepCount !== recordedActionCount) {
    return {
      ok: false,
      message: `Lossless replay: expected exactly ${recordedActionCount} steps after normalization, got ${emittedStepCount}.`,
    };
  }
  return { ok: true };
}
