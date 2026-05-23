import type { KatalonProjectContext } from "../../types/index.js";
import type { GenerationPlan, ProjectIndex } from "./types.js";

/**
 * Merge indexed project into legacy KatalonProjectContext for LLM / prompt paths.
 */
export function indexToKatalonProjectContext(index: ProjectIndex): KatalonProjectContext {
  return {
    projectName: index.projectName,
    objectRepository: index.testObjects.map((o) => o.path),
    keywords: index.keywords.flatMap((k) =>
      k.methods.map((m) => `${k.customKeywordsPath}.${m.name}`)
    ),
    testCases: (index.testScripts ?? index.testCases ?? []).map((t) => t.logicalPath),
    testSuites: index.testSuitePaths,
    importHints: [
      ...index.codingStyleHints,
      `Indexed project: ${index.stats.testObjects} test objects, ${index.stats.keywordMethods} keyword methods, ${index.stats.testScripts ?? index.stats.testCases ?? 0} test scripts.`,
    ],
  };
}

export function planToPromptHints(plan: GenerationPlan): string {
  const lines: string[] = [
    "=== PROJECT INTELLIGENCE (indexed Katalon project) ===",
    `Mode: ${plan.mode}`,
  ];
  for (const s of plan.suggestions) lines.push(`- ${s}`);
  for (const w of plan.warnings) lines.push(`- WARN: ${w}`);
  for (const b of plan.bindings) {
    if (b.keywordCall) {
      lines.push(`Step ${b.stepIndex + 1}: reuse keyword → ${b.keywordCall}`);
    } else if (b.orPath) {
      lines.push(`Step ${b.stepIndex + 1}: reuse findTestObject('${b.orPath}')`);
    }
  }
  return lines.join("\n");
}
