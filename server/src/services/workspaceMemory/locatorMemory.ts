import { scoreOrObject } from "../projectIntelligenceV2/orAnalyzer.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { MemoryIndex } from "./types.js";
import { appendChunk } from "./vectorStore.js";

export function ingestLocatorMemory(index: MemoryIndex, projectIndex: ProjectIndex): void {
  const weak = projectIndex.testObjects
    .map((o) => ({ o, score: scoreOrObject(o) }))
    .filter((x) => x.score.stabilityScore < 55)
    .slice(0, 20);

  for (const { o, score } of weak) {
    appendChunk(index, {
      id: `or-weak-${o.path.replace(/[^a-zA-Z0-9]/g, "_")}`,
      projectId: index.projectId,
      layer: "locator",
      title: `OR: ${o.label}`,
      content: `Path: ${o.path}\nSelector (${o.selectorType}): ${o.selector.slice(0, 100)}\nIssues: ${score.issues.join("; ")}`,
      confidence: score.stabilityScore / 100,
      source: "or_analysis",
      updatedAt: new Date().toISOString(),
    });
  }

  appendChunk(index, {
    id: "locator-strategy-summary",
    projectId: index.projectId,
    layer: "locator",
    title: "Locator health summary",
    content: `Total OR: ${projectIndex.stats.testObjects}. Weak locators flagged: ${weak.length}. Prefer ID/name over long XPath.`,
    confidence: 0.85,
    source: "or_summary",
    updatedAt: new Date().toISOString(),
  });
}
