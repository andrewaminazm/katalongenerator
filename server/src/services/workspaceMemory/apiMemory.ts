import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { MemoryIndex } from "./types.js";
import { appendChunk } from "./vectorStore.js";

export function ingestApiMemory(index: MemoryIndex, projectIndex: ProjectIndex): void {
  const apiKeywords = projectIndex.keywords.filter(
    (k) =>
      /api|rest|ws|request|auth|token/i.test(k.className) ||
      /api|rest/i.test(k.customKeywordsPath)
  );

  for (const kw of apiKeywords.slice(0, 15)) {
    appendChunk(index, {
      id: `api-kw-${kw.className}`,
      projectId: index.projectId,
      layer: "api",
      title: `API keyword: ${kw.className}`,
      content: `${kw.customKeywordsPath}\nMethods: ${kw.methods.map((m) => m.name).join(", ")}`,
      confidence: 0.8,
      source: "api_keywords",
      updatedAt: new Date().toISOString(),
    });
  }

  const apiScripts = (projectIndex.testScripts ?? []).filter((s) =>
    /\/API\//i.test(s.logicalPath)
  );
  if (apiScripts.length > 0) {
    appendChunk(index, {
      id: "api-scripts-summary",
      projectId: index.projectId,
      layer: "api",
      title: "API test scripts",
      content: `Indexed API scripts: ${apiScripts.length}. Examples: ${apiScripts.slice(0, 5).map((s) => s.logicalPath).join(", ")}`,
      confidence: 0.75,
      source: "api_scripts",
      updatedAt: new Date().toISOString(),
    });
  }
}
