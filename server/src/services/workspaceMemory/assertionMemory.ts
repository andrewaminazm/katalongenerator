import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { MemoryIndex } from "./types.js";
import { appendChunk } from "./vectorStore.js";

export function ingestAssertionMemory(index: MemoryIndex, projectIndex: ProjectIndex): void {
  const hints = projectIndex.codingStyleHints.filter((h) =>
    /assert|verify|check|validate/i.test(h)
  );

  appendChunk(index, {
    id: "assertion-style",
    projectId: index.projectId,
    layer: "assertion",
    title: "Assertion patterns",
    content:
      hints.length > 0
        ? hints.join("\n")
        : "Use WebUI.verifyElementPresent, WebUI.verifyMatch, and API status/body checks consistent with team style.",
    confidence: 0.8,
    source: "coding_style",
    updatedAt: new Date().toISOString(),
  });

  const verifyKeywords = projectIndex.keywords
    .flatMap((k) => k.methods)
    .filter((m) => /verify|assert|check|validate/i.test(m.name))
    .slice(0, 15);

  if (verifyKeywords.length > 0) {
    appendChunk(index, {
      id: "assertion-keywords",
      projectId: index.projectId,
      layer: "assertion",
      title: "Reusable verification keywords",
      content: verifyKeywords.map((m) => m.name).join(", "),
      confidence: 0.75,
      source: "keywords",
      updatedAt: new Date().toISOString(),
    });
  }
}
