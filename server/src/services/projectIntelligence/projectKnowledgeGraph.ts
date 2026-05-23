import type {
  GraphEdge,
  ParsedKeywordClass,
  ParsedTestScript,
  ParsedTestObject,
  ProjectKnowledgeGraphData,
  ReusableFlow,
} from "./types.js";

export function buildKnowledgeGraph(
  testObjects: ParsedTestObject[],
  keywords: ParsedKeywordClass[],
  testScripts: ParsedTestScript[],
  flows: ReusableFlow[]
): ProjectKnowledgeGraphData {
  const nodes: ProjectKnowledgeGraphData["nodes"] = [];
  const edges: GraphEdge[] = [];

  for (const o of testObjects) {
    nodes.push({ id: `or:${o.path}`, kind: "test_object" });
  }
  for (const kw of keywords) {
    nodes.push({ id: `kw:${kw.customKeywordsPath}`, kind: "keyword" });
  }
  for (const script of testScripts) {
    nodes.push({ id: `script:${script.logicalPath}`, kind: "test_script" });
    for (const ref of script.findTestObjectRefs) {
      edges.push({
        from: `script:${script.logicalPath}`,
        to: `or:${ref}`,
        type: "uses_test_object",
      });
    }
    for (const ref of script.customKeywordRefs) {
      edges.push({
        from: `script:${script.logicalPath}`,
        to: `kw:${ref.split(".").slice(0, -1).join(".") || ref}`,
        type: "test_script_uses_keyword",
      });
    }
  }
  for (const f of flows) {
    nodes.push({ id: `flow:${f.id}`, kind: "flow" });
  }

  return { nodes, edges };
}

export function neighbors(
  graph: ProjectKnowledgeGraphData,
  nodeId: string
): GraphEdge[] {
  return graph.edges.filter((e) => e.from === nodeId || e.to === nodeId);
}
