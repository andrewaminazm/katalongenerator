import type {
  AutomationIntentType,
  ExecutionPlan,
  GeneratorKind,
  IntentAnalysis,
  OrchestrationMode,
  PlannedTask,
} from "./types.js";

function generatorForIntent(intent: AutomationIntentType): GeneratorKind {
  switch (intent) {
    case "keywordGeneration":
      return "keywordGenerator";
    case "pageObjectGeneration":
      return "pageObjectGenerator";
    case "apiGeneration":
      return "apiHelperGenerator";
    case "dbUtilityGeneration":
      return "dbUtilityGenerator";
    case "utilityGeneration":
    case "frameworkArchitecture":
      return "architectureGenerator";
    case "frameworkRefactor":
      return "refactorEngine";
    case "frameworkOptimization":
      return "optimizationEngine";
    case "debugging":
    case "flakyTestAnalysis":
      return "debuggingEngine";
    case "conversationalAdvice":
    case "projectAnalysis":
    case "codeReview":
      return "conversationalEngine";
    case "locatorHealing":
      return "debuggingEngine";
    default:
      return "deterministicCompiler";
  }
}

function agentForGenerator(gen: GeneratorKind): PlannedTask["agent"] {
  switch (gen) {
    case "architectureGenerator":
    case "utilityGenerator":
    case "pageObjectGenerator":
    case "apiHelperGenerator":
    case "dbUtilityGenerator":
      return "groovyFramework";
    case "debuggingEngine":
      return "debugging";
    case "refactorEngine":
      return "refactor";
    case "optimizationEngine":
      return "optimization";
    case "conversationalEngine":
      return "katalonExpert";
    default:
      return "katalonExpert";
  }
}

function splitMixedPrompt(raw: string): { utility?: string; test?: string[]; pageObject?: string } {
  const lower = raw.toLowerCase();
  const parts: ReturnType<typeof splitMixedPrompt> = {};
  if (/\bpage\s*object\b/.test(lower)) {
    parts.pageObject = raw;
  }
  if (/\b(helper|utility|function|keyword)\b/.test(lower)) {
    parts.utility = raw;
  }
  if (/\b(test|click|verify|visit)\b/.test(lower)) {
    parts.test = raw.split(/\band\b/i).map((s) => s.trim()).filter(Boolean);
  }
  return parts;
}

export function routeCapabilities(
  intent: IntentAnalysis,
  steps: string[],
  mode: OrchestrationMode
): { generators: GeneratorKind[]; agents: PlannedTask["agent"][] } {
  const generators = new Set<GeneratorKind>();
  const agents = new Set<PlannedTask["agent"]>();

  const add = (i: AutomationIntentType) => {
    const g = generatorForIntent(i);
    generators.add(g);
    agents.add(agentForGenerator(g));
  };

  add(intent.primary);
  for (const s of intent.secondary) add(s);

  if (intent.primary === "mixedIntent") {
    const split = splitMixedPrompt(intent.raw);
    if (split.utility) add("utilityGeneration");
    if (split.pageObject) add("pageObjectGeneration");
    if (split.test?.length) add("testGeneration");
  }

  generators.add("validation" as GeneratorKind);
  agents.add("validation");
  agents.add("security");

  if (mode === "autonomous" || mode === "self_healing") {
    generators.add("debuggingEngine");
    agents.add("debugging");
  }

  return {
    generators: [...generators].filter((g) => g !== ("validation" as GeneratorKind)),
    agents: [...agents].filter((a) => a !== "validation"),
  };
}

export function buildInitialPlan(
  intent: IntentAnalysis,
  steps: string[],
  mode: OrchestrationMode
): ExecutionPlan {
  const tasks: PlannedTask[] = [];
  let priority = 0;

  const enqueue = (
    id: string,
    taskIntent: AutomationIntentType,
    description: string,
    taskSteps: string[],
    deps: string[] = []
  ) => {
    const generator = generatorForIntent(taskIntent);
    tasks.push({
      id,
      intent: taskIntent,
      generator,
      agent: agentForGenerator(generator),
      description,
      steps: taskSteps,
      dependsOn: deps,
      priority: priority++,
    });
  };

  if (intent.primary === "mixedIntent") {
    const lower = intent.raw.toLowerCase();
    if (/\b(helper|utility|function)\b/.test(lower)) {
      enqueue("utility", "utilityGeneration", "Generate reusable helper/utility", [intent.raw]);
    }
    if (/\bpage\s*object\b/.test(lower)) {
      enqueue("page", "pageObjectGeneration", "Generate page object", [intent.raw], ["utility"]);
    }
    if (/\b(test|using both)\b/.test(lower)) {
      enqueue(
        "test",
        "testGeneration",
        "Generate test script",
        steps.length ? steps : [intent.raw],
        ["utility", "page"].filter((d) => tasks.some((t) => t.id === d))
      );
    }
  } else if (intent.primary === "projectAnalysis") {
    enqueue("analyze", "projectAnalysis", "Analyze project framework", [intent.raw]);
    enqueue(
      "suggest",
      "conversationalAdvice",
      "Suggest improvements",
      [intent.raw],
      ["analyze"]
    );
  } else if (
    intent.primary === "conversationalAdvice" ||
    intent.primary === "debugging" ||
    intent.primary === "flakyTestAnalysis"
  ) {
    enqueue("advice", intent.primary, "Engineering analysis", [intent.raw]);
  } else {
    enqueue(
      "main",
      intent.primary === "unknown" ? "testGeneration" : intent.primary,
      `Execute ${intent.primary}`,
      steps.length ? steps : [intent.raw]
    );
  }

  if (mode === "architecture_review" && !tasks.some((t) => t.intent === "projectAnalysis")) {
    enqueue("review", "projectAnalysis", "Architecture review pass", [intent.raw]);
  }

  return {
    tasks,
    parallel: false,
    mode,
  };
}
