import { buildKnowledgeGraph } from "../projectIntelligence/projectKnowledgeGraph.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import { findDuplicateSelectors } from "./orAnalyzer.js";
import type { ProjectGraphV2 } from "./types.js";

export function buildProjectGraphV2(index: ProjectIndex): ProjectGraphV2 {
  const scripts = index.testScripts ?? index.testCases ?? [];
  const base = buildKnowledgeGraph(
    index.testObjects,
    index.keywords,
    scripts,
    index.reusableFlows ?? []
  );

  const testObjectUsedBy: Record<string, string[]> = {};
  const keywordUsedBy: Record<string, string[]> = {};

  for (const edge of base.edges) {
    if (edge.type === "uses_test_object") {
      const list = testObjectUsedBy[edge.to] ?? [];
      list.push(edge.from);
      testObjectUsedBy[edge.to] = list;
    }
    if (edge.type === "test_script_uses_keyword" || edge.type === "test_case_uses_keyword") {
      const list = keywordUsedBy[edge.to] ?? [];
      list.push(edge.from);
      keywordUsedBy[edge.to] = list;
    }
  }

  const usedOr = new Set(Object.keys(testObjectUsedBy));
  const usedKw = new Set(Object.keys(keywordUsedBy));
  const scriptIds = new Set(scripts.map((s) => `script:${s.logicalPath}`));

  const orphans = {
    testObjects: index.testObjects
      .map((o) => `or:${o.path}`)
      .filter((id) => !usedOr.has(id)),
    keywords: index.keywords
      .map((k) => `kw:${k.customKeywordsPath}`)
      .filter((id) => !usedKw.has(id)),
    testScripts: [...base.nodes]
      .filter((n) => n.kind === "test_script")
      .map((n) => n.id)
      .filter((id) => {
        const hasEdge = base.edges.some((e) => e.from === id);
        return !hasEdge;
      }),
  };

  const dupSelectors = findDuplicateSelectors(index.testObjects);
  const flowPatterns = new Map<string, string[]>();
  for (const s of scripts) {
    const key = s.findTestObjectRefs.slice(0, 5).join("→");
    if (!key) continue;
    const list = flowPatterns.get(key) ?? [];
    list.push(s.logicalPath);
    flowPatterns.set(key, list);
  }

  const suites = index.testSuitePaths.map((p) => ({
    id: `suite:${p}`,
    path: p,
  }));

  const apis = index.testObjects
    .filter((o) => /\/API\//i.test(o.path))
    .map((o) => ({ id: `api:${o.path}`, path: o.path }));

  for (const suite of suites) {
    base.nodes.push({ id: suite.id, kind: "test_script" });
  }
  for (const api of apis) {
    base.nodes.push({ id: api.id, kind: "test_object" });
  }

  return {
    ...base,
    suites,
    apis,
    reverseEdges: { testObjectUsedBy, keywordUsedBy },
    orphans,
    duplicates: {
      testObjects: dupSelectors,
      flows: [...flowPatterns.entries()]
        .filter(([, scripts]) => scripts.length > 1)
        .map(([pattern, scriptList]) => ({ pattern, scripts: scriptList })),
    },
  };
}

export function findImpactedTests(graph: ProjectGraphV2, orPath: string): string[] {
  const id = orPath.startsWith("or:") ? orPath : `or:${orPath}`;
  return graph.reverseEdges.testObjectUsedBy[id] ?? [];
}
