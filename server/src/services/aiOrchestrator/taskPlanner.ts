import type { ExecutionPlan, IntentAnalysis, OrchestrationMode } from "./types.js";
import { buildInitialPlan } from "./capabilityRouter.js";

export function planTasks(
  intent: IntentAnalysis,
  steps: string[],
  mode: OrchestrationMode
): ExecutionPlan {
  const plan = buildInitialPlan(intent, steps, mode);

  if (intent.complexity === "high" && intent.primary === "frameworkOptimization") {
    plan.tasks = [
      {
        id: "scan",
        intent: "projectAnalysis",
        generator: "conversationalEngine",
        agent: "optimization",
        description: "Scan retry/wait patterns",
        steps: [intent.raw],
        dependsOn: [],
        priority: 0,
      },
      {
        id: "optimize",
        intent: "frameworkOptimization",
        generator: "optimizationEngine",
        agent: "optimization",
        description: "Propose optimizations",
        steps: [intent.raw],
        dependsOn: ["scan"],
        priority: 1,
      },
    ];
  }

  if (intent.entities.mentionsFlaky && intent.primary === "flakyTestAnalysis") {
    plan.tasks = [
      {
        id: "flaky",
        intent: "flakyTestAnalysis",
        generator: "debuggingEngine",
        agent: "debugging",
        description: "Analyze flaky test patterns",
        steps: steps.length ? steps : [intent.raw],
        dependsOn: [],
        priority: 0,
      },
      {
        id: "fix",
        intent: "utilityGeneration",
        generator: "architectureGenerator",
        agent: "groovyFramework",
        description: "Suggest retry/wait helper improvements",
        steps: ["create retry helper with logging"],
        dependsOn: ["flaky"],
        priority: 1,
      },
    ];
  }

  return plan;
}

export function orderTasks(plan: ExecutionPlan): ExecutionPlan {
  const sorted = [...plan.tasks].sort((a, b) => {
    const depA = a.dependsOn.length;
    const depB = b.dependsOn.length;
    if (depA !== depB) return depA - depB;
    return a.priority - b.priority;
  });
  return { ...plan, tasks: sorted };
}
