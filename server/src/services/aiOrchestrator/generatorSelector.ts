import type { GeneratorKind, OrchestratorInput, PlannedTask } from "./types.js";
import type { UserGenerationMode } from "../groovyGenerator/generationModeRouter.js";

export interface GeneratorSelection {
  generator: GeneratorKind;
  userMode: UserGenerationMode;
  forceDeterministic: boolean;
  hybrid: boolean;
}

export function selectGenerator(
  task: PlannedTask,
  input: OrchestratorInput
): GeneratorSelection {
  const mode = input.orchestrationMode ?? "basic";
  const forceDeterministic =
    input.deterministicCompiler !== false ||
    mode === "basic" ||
    !input.authorizationToken?.trim();

  switch (task.generator) {
    case "pageObjectGenerator":
      return { generator: task.generator, userMode: "page_object", forceDeterministic, hybrid: false };
    case "apiHelperGenerator":
      return { generator: task.generator, userMode: "api_helper", forceDeterministic, hybrid: false };
    case "dbUtilityGenerator":
      return { generator: task.generator, userMode: "db_utility", forceDeterministic, hybrid: false };
    case "architectureGenerator":
    case "utilityGenerator":
      return {
        generator: task.generator,
        userMode: "framework_helper",
        forceDeterministic,
        hybrid: false,
      };
    case "keywordGenerator":
      return { generator: task.generator, userMode: "custom_keyword", forceDeterministic, hybrid: false };
    case "refactorEngine":
    case "optimizationEngine":
    case "debuggingEngine":
    case "conversationalEngine":
      return {
        generator: task.generator,
        userMode: "auto",
        forceDeterministic: true,
        hybrid: false,
      };
    case "deterministicCompiler":
    default:
      return {
        generator: "deterministicCompiler",
        userMode: input.codeGenerationMode ?? "test_script",
        forceDeterministic: true,
        hybrid: task.intent === "mixedIntent",
      };
  }
}
