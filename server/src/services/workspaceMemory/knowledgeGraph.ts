import { buildProjectGraphV2 } from "../projectIntelligenceV2/projectGraphV2.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";

export function buildKnowledgeGraphExport(projectIndex: ProjectIndex): {
  nodes: Array<{ id: string; label: string; kind: string }>;
  edges: Array<{ from: string; to: string; type: string }>;
} {
  const graph = buildProjectGraphV2(projectIndex);
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: n.id.replace(/^(or|kw|script|flow):/, ""),
      kind: n.kind,
    })),
    edges: graph.edges.map((e) => ({
      from: e.from,
      to: e.to,
      type: e.type,
    })),
  };
}
