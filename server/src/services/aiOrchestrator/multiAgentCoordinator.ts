import { compileKatalonScript } from "../katalonCompiler/index.js";
import { routeSpecializedGeneration } from "../groovyGenerator/generationModeRouter.js";
import { loadProjectIndex } from "../projectIntelligence/projectStore.js";
import { compileArchitectureGroovy } from "../groovyArchitecture/groovyFunctionGenerator.js";
import type { CompileKatalonInput } from "../katalonCompiler/types.js";
import type {
  AgentRole,
  OrchestratorContext,
  OrchestratorInput,
  PlannedTask,
  TaskArtifact,
} from "./types.js";
import { selectGenerator } from "./generatorSelector.js";

const AGENT_LABELS: Record<AgentRole, string> = {
  katalonExpert: "Katalon Expert",
  groovyFramework: "Groovy Framework",
  debugging: "Debugging",
  refactor: "Refactor",
  optimization: "Optimization",
  validation: "Validation",
  security: "Security",
};

function advisoryForTask(task: PlannedTask, context: OrchestratorContext): string {
  const lines = [
    `## ${AGENT_LABELS[task.agent]} analysis`,
    "",
    `**Request:** ${task.description}`,
    "",
  ];
  if (context.styleProfileSummary) {
    lines.push(`**Project style:** ${context.styleProfileSummary}`, "");
  }
  if (context.healingHints.length) {
    lines.push("**Recent healing memory:**", ...context.healingHints.map((h) => `- ${h}`), "");
  }
  if (task.intent === "flakyTestAnalysis") {
    lines.push(
      "- Review wait strategy and dynamic locators",
      "- Extract shared retry helper with logging",
      "- Stabilize assertions with explicit state checks"
    );
  } else if (task.intent === "conversationalAdvice" || task.intent === "projectAnalysis") {
    lines.push(
      "- Map keyword-driven vs page-object coverage",
      "- Consolidate duplicate helpers and waits",
      "- Align new tests with dominant OR naming patterns"
    );
  } else if (task.intent === "frameworkOptimization") {
    lines.push(
      "- Reduce redundant WebUI.wait calls",
      "- Prefer project custom wait keywords",
      "- Batch setup/teardown in shared hooks"
    );
  }
  return lines.join("\n");
}

export async function executeTask(
  task: PlannedTask,
  input: OrchestratorInput,
  context: OrchestratorContext
): Promise<TaskArtifact> {
  const selection = selectGenerator(task, input);
  const steps = task.steps.length ? task.steps : [input.prompt];
  const warnings: string[] = [`Agent: ${AGENT_LABELS[task.agent]}`];

  const projectIndex = input.projectId ? await loadProjectIndex(input.projectId) : null;
  const projectKeywords = projectIndex?.keywords;

  if (
    task.generator === "conversationalEngine" ||
    task.generator === "debuggingEngine" ||
    task.generator === "optimizationEngine" ||
    task.generator === "refactorEngine"
  ) {
    return {
      taskId: task.id,
      generator: task.generator,
      agent: task.agent,
      code: `// Advisory mode — see conversationalResponse in orchestrator result\n`,
      model: "orchestrator-advisory",
      warnings,
      validationErrors: [],
      metadata: { advisory: advisoryForTask(task, context) },
    };
  }

  if (
    task.generator === "architectureGenerator" ||
    task.generator === "pageObjectGenerator" ||
    task.generator === "apiHelperGenerator" ||
    task.generator === "dbUtilityGenerator" ||
    task.generator === "utilityGenerator"
  ) {
    const arch = await compileArchitectureGroovy(steps.join("\n"), {
      authorizationToken: input.authorizationToken,
      model: input.model,
      projectHint: context.projectHint,
      aiMemoryInjection: context.aiMemoryInjection,
      forceDeterministic: selection.forceDeterministic,
      projectKeywords,
    });
    return {
      taskId: task.id,
      generator: task.generator,
      agent: task.agent,
      code: arch?.code ?? "",
      model: arch?.model ?? "architecture",
      warnings: [...warnings, ...(arch?.warnings ?? [])],
      validationErrors: arch?.validationErrors ?? [],
      generationMode: "groovy_utility",
      metadata: { architecture: arch?.architecture, componentKind: arch?.componentKind },
    };
  }

  const compileTestInput: CompileKatalonInput = {
    platform: input.platform,
    steps,
    locatorsText: context.mergedLocators ?? input.locators ?? "",
    url: context.projectDefaultUrl ?? input.url,
    testCaseName: input.testCaseName,
  };

  const routed = await routeSpecializedGeneration({
    steps,
    userMode: selection.userMode,
    platform: input.platform,
    authorizationToken: input.authorizationToken,
    model: input.model,
    projectHint: context.projectHint,
    aiMemoryInjection: context.aiMemoryInjection,
    projectKeywords,
    compileTestInput: selection.hybrid ? compileTestInput : undefined,
  });

  if (routed.handled && routed.code) {
    return {
      taskId: task.id,
      generator: task.generator,
      agent: task.agent,
      code: routed.code,
      model: routed.model ?? "routed",
      warnings: [...warnings, ...(routed.warnings ?? [])],
      validationErrors: routed.validationErrors ?? [],
      generationMode: routed.generationMode,
      metadata: {
        groovyUtility: routed.groovyUtility,
        keywordTemplate: routed.keywordTemplate,
      },
    };
  }

  const compiled = compileKatalonScript(compileTestInput);
  return {
    taskId: task.id,
    generator: "deterministicCompiler",
    agent: task.agent,
    code: compiled.code,
    model: compiled.model,
    warnings: [...warnings, ...compiled.warnings],
    validationErrors: compiled.validationErrors,
    generationMode: "test_case",
  };
}
