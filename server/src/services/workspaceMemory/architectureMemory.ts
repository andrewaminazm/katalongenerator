import { buildProjectGraphV2 } from "../projectIntelligenceV2/projectGraphV2.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { MemoryIndex } from "./types.js";
import { appendChunk } from "./vectorStore.js";

export function ingestArchitectureMemory(index: MemoryIndex, projectIndex: ProjectIndex): void {
  const graph = buildProjectGraphV2(projectIndex);

  appendChunk(index, {
    id: "architecture-graph",
    projectId: index.projectId,
    layer: "architecture",
    title: "Project knowledge graph",
    content: [
      `Nodes: ${graph.nodes.length}, Edges: ${graph.edges.length}`,
      `Orphan OR: ${graph.orphans.testObjects.length}, Orphan keywords: ${graph.orphans.keywords.length}`,
      `Duplicate OR selectors: ${graph.duplicates.testObjects.length}`,
      `Duplicate flows: ${graph.duplicates.flows.length}`,
    ].join("\n"),
    confidence: 0.88,
    source: "project_graph_v2",
    updatedAt: new Date().toISOString(),
  });

  for (const flow of graph.duplicates.flows.slice(0, 6)) {
    appendChunk(index, {
      id: `arch-dup-flow-${flow.pattern.slice(0, 20)}`,
      projectId: index.projectId,
      layer: "architecture",
      title: "Duplicate flow pattern",
      content: `Pattern: ${flow.pattern.slice(0, 120)}\nScripts: ${flow.scripts.slice(0, 5).join(", ")}`,
      confidence: 0.8,
      source: "graph_duplicates",
      updatedAt: new Date().toISOString(),
    });
  }
}
