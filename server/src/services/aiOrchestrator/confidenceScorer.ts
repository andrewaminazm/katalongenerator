import type { ConfidenceReport, IntentAnalysis, OrchestratorContext, TaskArtifact } from "./types.js";
import type { ValidationResult } from "./validationOrchestrator.js";

export function scoreConfidence(
  intent: IntentAnalysis,
  context: OrchestratorContext,
  artifacts: TaskArtifact[],
  validation: ValidationResult
): ConfidenceReport {
  const intentScore = intent.ambiguous ? intent.confidence * 0.7 : intent.confidence;

  let architecture = 0.75;
  if (context.aiMemoryInjection) architecture += 0.1;
  if (context.projectId) architecture += 0.08;
  if (context.reusableFlowHints.length) architecture += 0.05;
  architecture = Math.min(1, architecture);

  let style = 0.6;
  if (context.styleProfileSummary) style += 0.25;
  if (context.conversationPrefs.length) style += 0.1;
  style = Math.min(1, style);

  const validationScore = validation.ok
    ? 0.95
    : Math.max(0.2, 0.9 - validation.errors.length * 0.15);

  const artifactPenalty =
    artifacts.length === 0 ? 0.3 : artifacts.some((a) => a.validationErrors.length) ? 0.15 : 0;

  const overall = Math.max(
    0,
    Math.min(
      1,
      intentScore * 0.35 +
        architecture * 0.25 +
        style * 0.15 +
        validationScore * 0.25 -
        artifactPenalty
    )
  );

  return {
    intent: intentScore,
    architecture,
    style,
    validation: validationScore,
    overall,
  };
}

export function shouldAskClarification(
  confidence: ConfidenceReport,
  intent: IntentAnalysis
): boolean {
  return (
    (intent.ambiguous && confidence.intent < 0.55) ||
    (confidence.overall < 0.45 && Boolean(intent.clarifyingQuestion))
  );
}
