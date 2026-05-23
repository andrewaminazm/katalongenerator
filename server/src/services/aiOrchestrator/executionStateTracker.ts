import type { ExecutionPlan, OrchestratorContext, TaskArtifact } from "./types.js";

export interface ExecutionState {
  plan: ExecutionPlan;
  context: OrchestratorContext;
  artifacts: TaskArtifact[];
  currentTaskId?: string;
  repairAttempts: number;
  startedAt: number;
  status: "pending" | "running" | "validating" | "repairing" | "completed" | "failed";
  errors: string[];
}

export function createExecutionState(
  plan: ExecutionPlan,
  context: OrchestratorContext
): ExecutionState {
  return {
    plan,
    context,
    artifacts: [],
    repairAttempts: 0,
    startedAt: Date.now(),
    status: "pending",
    errors: [],
  };
}

export function markTaskComplete(state: ExecutionState, artifact: TaskArtifact): void {
  state.artifacts = state.artifacts.filter((a) => a.taskId !== artifact.taskId);
  state.artifacts.push(artifact);
  state.currentTaskId = undefined;
}

export function snapshotState(state: ExecutionState): Record<string, unknown> {
  return {
    status: state.status,
    taskCount: state.plan.tasks.length,
    completed: state.artifacts.length,
    repairAttempts: state.repairAttempts,
    elapsedMs: Date.now() - state.startedAt,
  };
}
