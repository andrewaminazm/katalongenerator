import { autoFixGroovy } from "../katalonCompiler/autoFixEngine.js";
import type { GeneratorSelection } from "./generatorSelector.js";
import type { OrchestratorContext, TaskArtifact } from "./types.js";
import { validateArtifact } from "./validationOrchestrator.js";

const MAX_REPAIR = 2;

export interface RepairResult {
  artifact: TaskArtifact;
  repairAttempts: number;
  repaired: boolean;
}

export async function repairArtifact(
  artifact: TaskArtifact,
  selection: GeneratorSelection,
  context: OrchestratorContext,
  platform: "web" | "mobile" = "web"
): Promise<RepairResult> {
  let current = { ...artifact };
  let attempts = 0;
  let repaired = false;

  while (attempts < MAX_REPAIR) {
    const validation = validateArtifact(current);
    if (validation.ok) break;

    const before = current.code;
    current = {
      ...current,
      code: autoFixGroovy(current.code, platform),
      warnings: [...current.warnings, `Self-repair pass ${attempts + 1}`],
      validationErrors: [],
    };
    if (current.code === before) break;

    attempts++;
    repaired = true;

    const revalidate = validateArtifact(current);
    current.validationErrors = revalidate.errors;
    if (revalidate.ok) break;
  }

  if (selection.forceDeterministic && current.validationErrors.length > 0) {
    current.warnings.push(
      "Repair exhausted; consider enabling AI synthesis (authorization token) or clarifying the request."
    );
  }

  void context;
  return { artifact: current, repairAttempts: attempts, repaired };
}
