import type { ProjectIndex } from "../projectIntelligence/types.js";
import { loadProjectMemory } from "../aiMemory/aiMemoryStore.js";
import type { MemoryChunk } from "./types.js";
import { appendChunk } from "./vectorStore.js";
import type { MemoryIndex } from "./types.js";

export async function ingestProjectMemory(index: MemoryIndex, projectIndex: ProjectIndex): Promise<void> {
  appendChunk(index, {
    id: "project-structure",
    projectId: index.projectId,
    layer: "project",
    title: "Project structure",
    content: [
      `Project: ${projectIndex.projectName}`,
      `OR: ${projectIndex.stats.testObjects}, Keywords: ${projectIndex.stats.keywords}`,
      `Scripts: ${projectIndex.stats.testScripts}, Suites: ${projectIndex.stats.testSuites}`,
      `Coding hints: ${projectIndex.codingStyleHints.slice(0, 5).join("; ")}`,
    ].join("\n"),
    confidence: 0.95,
    source: "project_intelligence",
    updatedAt: new Date().toISOString(),
  });

  const profile = await loadProjectMemory(projectIndex.projectId);
  if (profile) {
    appendChunk(index, {
      id: "team-style-profile",
      projectId: index.projectId,
      layer: "pattern",
      title: "Team coding style (AI Memory)",
      content: [
        `Naming: ${profile.naming.testObjectPattern}`,
        `Locators: ${profile.locators.dominantStrategy}`,
        `Waits: ${profile.waits.dominantPattern}`,
        `Assertions: ${profile.assertions.dominantPattern}`,
        `Top keywords: ${profile.topKeywords.slice(0, 6).map((k) => k.path).join(", ")}`,
      ].join("\n"),
      confidence: 0.9,
      source: "ai_memory",
      updatedAt: profile.builtAt,
    });
  }

  for (const kw of projectIndex.keywords.slice(0, 25)) {
    appendChunk(index, {
      id: `kw-${kw.className}`,
      projectId: index.projectId,
      layer: "framework",
      title: `Keyword: ${kw.className}`,
      content: `Path: ${kw.customKeywordsPath}\nMethods: ${kw.methods.slice(0, 8).map((m) => m.name).join(", ")}`,
      confidence: 0.75,
      source: "project_keywords",
      updatedAt: new Date().toISOString(),
    });
  }
}
