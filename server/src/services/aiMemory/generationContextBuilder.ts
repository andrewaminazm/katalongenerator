import type { AiMemoryMode, GenerationStyleContext, ProjectMemoryProfile } from "./types.js";
import type { ParsedTestScript } from "../projectIntelligence/types.js";
import { findMatchingFlows, findSimilarScripts } from "./similarityMatcher.js";

export function buildPromptInjectionBlock(profile: ProjectMemoryProfile): string {
  const lines: string[] = [
    "=== TEAM AI MEMORY (generate code in this project's style) ===",
    `Project: ${profile.projectName}`,
    "",
    "NAMING:",
    `- Test objects: ${profile.naming.testObjectPattern} (e.g. ${profile.naming.testObjectPrefixExamples.slice(0, 4).join(", ") || "see OR"})`,
    `- Classes: ${profile.naming.classNaming}, methods: ${profile.naming.methodNaming}`,
    "",
    "LOCATORS:",
    `- Dominant: ${profile.locators.dominantStrategy}`,
    `- Prefer: ${profile.locators.preferredSelectorTypes.join(", ") || "Object Repository"}`,
    "",
    "WAITS:",
    `- ${profile.waits.dominantPattern}`,
  ];

  if (profile.waits.customWaitKeywords.length > 0) {
    lines.push(`- Custom wait keywords: ${profile.waits.customWaitKeywords.slice(0, 5).join(", ")}`);
  } else if (Object.keys(profile.waits.webUiWaitCalls).length > 0) {
    const top = Object.entries(profile.waits.webUiWaitCalls)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k]) => k);
    lines.push(`- Common: ${top.join(", ")}`);
  }

  lines.push("", "ASSERTIONS:", `- ${profile.assertions.dominantPattern}`);
  if (profile.assertions.prefersSoftAssertions) {
    lines.push("- Team uses soft / match-style verification where applicable");
  }

  if (profile.topKeywords.length > 0) {
    lines.push(
      "",
      "PREFERRED CUSTOM KEYWORDS (reuse instead of raw WebUI when applicable):",
      ...profile.topKeywords.slice(0, 8).map(
        (k) => `- CustomKeywords.'${k.path}' (${k.callCount} refs) — methods: ${k.methodNames.slice(0, 4).join(", ")}`
      )
    );
  }

  if (profile.architecture.keywordDrivenScore > 0.35) {
    lines.push(
      "",
      `ARCHITECTURE: keyword-driven (score ${(profile.architecture.keywordDrivenScore * 100).toFixed(0)}%)`
    );
    if (profile.architecture.utilityClassHints.length > 0) {
      lines.push(`- Utilities: ${profile.architecture.utilityClassHints.slice(0, 5).join(", ")}`);
    }
  }

  if (profile.reusableFlows.length > 0) {
    lines.push(
      "",
      "REUSABLE FLOWS:",
      ...profile.reusableFlows.slice(0, 4).map((f) => `- ${f.name}${f.suggestedKeyword ? ` → ${f.suggestedKeyword}` : ""}`)
    );
  }

  if (profile.antiPatterns.length > 0) {
    lines.push("", "AVOID:");
    for (const a of profile.antiPatterns.slice(0, 3)) {
      lines.push(`- ${a.message}`);
    }
  }

  lines.push(
    "",
    "RULES:",
    "- Match team naming and abstraction level",
    "- Prefer findTestObject for OR-backed elements",
    "- Do not invent keywords or OR paths that are not listed above",
    "- Generate production Groovy only — no markdown",
    "=== END TEAM AI MEMORY ===",
    ""
  );

  return lines.join("\n");
}

export function buildGenerationStyleContext(
  profile: ProjectMemoryProfile,
  steps: string[],
  testScripts: ParsedTestScript[],
  mode: AiMemoryMode
): GenerationStyleContext {
  const similarScripts = findSimilarScripts(steps, testScripts, profile);
  const flows = findMatchingFlows(steps, profile);

  const styleMatchHints: string[] = [];
  if (similarScripts[0]) {
    styleMatchHints.push(`Similar script: ${similarScripts[0].logicalPath} (${(similarScripts[0].score * 100).toFixed(0)}% match)`);
  }
  for (const f of flows.slice(0, 2)) {
    styleMatchHints.push(`Reusable flow: ${f.name}`);
  }

  let injectionText = profile.promptInjectionBlock;
  if (mode === "learn_suggest" || mode === "adaptive") {
    if (similarScripts.length > 0) {
      injectionText += "\nSIMILAR EXISTING TESTS:\n";
      for (const s of similarScripts.slice(0, 3)) {
        injectionText += `- ${s.logicalPath}: ${s.summary}\n`;
        if (s.keywordRefs.length) injectionText += `  Keywords: ${s.keywordRefs.join(", ")}\n`;
      }
    }
  }

  return {
    profile,
    similarScripts: similarScripts.map((s) => ({
      logicalPath: s.logicalPath,
      score: s.score,
      summary: s.summary,
    })),
    injectionText,
    styleMatchHints,
  };
}
