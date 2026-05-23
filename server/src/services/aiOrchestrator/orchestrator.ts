import type { OrchestratorInput, OrchestratorResult } from "./types.js";
import { analyzeIntent } from "./intentEngine.js";
import { routeCapabilities } from "./capabilityRouter.js";
import { planTasks, orderTasks } from "./taskPlanner.js";
import { buildOrchestratorContext } from "./contextBuilder.js";
import { executeTask } from "./multiAgentCoordinator.js";
import { assembleResponse, buildSuggestions } from "./responseAssembler.js";
import { validateAllArtifacts } from "./validationOrchestrator.js";
import { repairArtifact } from "./selfRepairLoop.js";
import { scoreConfidence, shouldAskClarification } from "./confidenceScorer.js";
import { createExecutionState, markTaskComplete } from "./executionStateTracker.js";
import { inferPrefsFromPrompt, saveConversationPrefs } from "./conversationMemory.js";
import { selectGenerator } from "./generatorSelector.js";
import { lintGroovy } from "../groovyLint.js";

export async function runOrchestration(input: OrchestratorInput): Promise<OrchestratorResult> {
  const mode = input.orchestrationMode ?? "advanced";
  const steps = input.steps?.length
    ? input.steps
    : input.prompt.split(/\n/).map((s) => s.trim()).filter(Boolean);

  const intent = analyzeIntent(input.prompt, steps);
  const context = await buildOrchestratorContext(input);

  if (input.projectId) {
    await saveConversationPrefs(input.projectId, inferPrefsFromPrompt(input.prompt));
  }

  routeCapabilities(intent, steps, mode);
  const plan = orderTasks(planTasks(intent, steps, mode));
  const state = createExecutionState(plan, context);
  state.status = "running";

  const advisoryParts: string[] = [];

  for (const task of plan.tasks) {
    const depsOk = task.dependsOn.every((dep) =>
      state.artifacts.some((a) => a.taskId === dep)
    );
    if (!depsOk && task.dependsOn.length > 0) continue;

    state.currentTaskId = task.id;
    let artifact = await executeTask(task, input, context);

    if (mode === "self_healing" || mode === "autonomous") {
      state.status = "validating";
      const selection = selectGenerator(task, input);
      const repaired = await repairArtifact(artifact, selection, context, input.platform);
      artifact = repaired.artifact;
      state.repairAttempts += repaired.repairAttempts;
    }

    markTaskComplete(state, artifact);
    const meta = artifact.metadata as { advisory?: string } | undefined;
    if (meta?.advisory) advisoryParts.push(meta.advisory);
  }

  state.status = "validating";
  const validation = validateAllArtifacts(state.artifacts);

  if (!validation.ok && (mode === "self_healing" || mode === "autonomous")) {
    state.status = "repairing";
    for (let i = 0; i < state.artifacts.length; i++) {
      const task = plan.tasks.find((t) => t.id === state.artifacts[i]!.taskId);
      if (!task) continue;
      const selection = selectGenerator(task, input);
      const repaired = await repairArtifact(
        state.artifacts[i]!,
        selection,
        context,
        input.platform
      );
      state.artifacts[i] = repaired.artifact;
      state.repairAttempts += repaired.repairAttempts;
    }
  }

  const finalValidation = validateAllArtifacts(state.artifacts);
  const confidence = scoreConfidence(intent, context, state.artifacts, finalValidation);

  const assembled = assembleResponse(
    state.artifacts,
    advisoryParts.length ? advisoryParts.join("\n\n") : undefined
  );

  let conversationalResponse: string | undefined;
  if (advisoryParts.length) {
    conversationalResponse = advisoryParts.join("\n\n");
  }
  if (shouldAskClarification(confidence, intent)) {
    conversationalResponse = [intent.clarifyingQuestion, conversationalResponse]
      .filter(Boolean)
      .join("\n\n");
  }

  state.status = finalValidation.ok ? "completed" : "failed";

  const result: OrchestratorResult = {
    ok: finalValidation.ok && state.artifacts.some((a) => a.code.trim().length > 0),
    code: assembled.code,
    model: assembled.model,
    intent,
    plan,
    artifacts: state.artifacts,
    warnings: [...assembled.warnings, ...finalValidation.warnings],
    lint: finalValidation.lint.length
      ? finalValidation.lint
      : lintGroovy(assembled.code, new Set(), {
          groovyUtility: state.artifacts.some((a) => a.generator !== "deterministicCompiler"),
        }),
    confidence,
    orchestration: {
      mode,
      agentsUsed: [...new Set(plan.tasks.map((t) => t.agent))],
      generatorsUsed: [...new Set(state.artifacts.map((a) => a.generator))],
      repairAttempts: state.repairAttempts,
    },
    conversationalResponse,
    suggestions: buildSuggestions({ intent, artifacts: state.artifacts, confidence }),
    generationMode: state.artifacts[0]?.generationMode,
    groovyUtility: state.artifacts[0]?.metadata?.groovyUtility as Record<string, unknown> | undefined,
    keywordTemplate: state.artifacts[0]?.metadata?.keywordTemplate as Record<string, unknown> | undefined,
  };

  return result;
}
