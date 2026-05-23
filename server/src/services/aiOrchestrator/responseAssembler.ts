import type { OrchestratorResult, TaskArtifact } from "./types.js";

export function assembleResponse(
  artifacts: TaskArtifact[],
  conversationalResponse?: string
): { code: string; model: string; warnings: string[] } {
  const warnings = artifacts.flatMap((a) => a.warnings);
  const models = [...new Set(artifacts.map((a) => a.model).filter(Boolean))];

  if (artifacts.length === 0) {
    return {
      code: conversationalResponse ?? "// No code artifacts generated",
      model: "orchestrator-advisory",
      warnings,
    };
  }

  if (artifacts.length === 1) {
    return {
      code: artifacts[0]!.code,
      model: artifacts[0]!.model,
      warnings,
    };
  }

  const sections = artifacts.map((a) => {
    const header = `// --- ${a.taskId} (${a.generator} / ${a.agent}) ---`;
    return `${header}\n${a.code.trim()}`;
  });

  return {
    code: sections.join("\n\n"),
    model: models.join("+") || "orchestrator-multi",
    warnings,
  };
}

export function buildSuggestions(result: Partial<OrchestratorResult>): string[] {
  const suggestions: string[] = [];
  if (result.confidence && result.confidence.validation < 0.7) {
    suggestions.push("Run Groovy lint in Katalon or enable self-healing mode to auto-fix imports.");
  }
  if (result.intent?.entities.mentionsFlaky) {
    suggestions.push("Consider adding explicit waits and a shared RetryHelper for flaky flows.");
  }
  if (result.intent?.entities.mentionsPageObject && result.artifacts?.length === 1) {
    suggestions.push("You may also want a matching test script that uses the new page object.");
  }
  return suggestions;
}
