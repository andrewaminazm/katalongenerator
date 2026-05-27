import { buildProjectGraphV2 } from "../projectIntelligenceV2/projectGraphV2.js";
import { loadProjectIndex } from "../projectIntelligence/index.js";
import type { RegressionImpactSummary } from "./types.js";

export async function predictRegressionImpact(
  projectId: string,
  corpus: string
): Promise<RegressionImpactSummary | undefined> {
  const index = await loadProjectIndex(projectId);
  if (!index) return undefined;

  const graph = buildProjectGraphV2(index);
  const kwMatch = index.keywords.find(
    (k) => corpus.includes(k.className) || corpus.includes(k.customKeywordsPath)
  );
  const orMatch = index.testObjects.find(
    (o) => corpus.includes(o.path) || corpus.includes(o.label)
  );

  const impactedKeywords = kwMatch
    ? graph.edges.filter((e) => e.to === `kw:${kwMatch.customKeywordsPath}`).length
    : 0;
  const impactedOr = orMatch ? graph.edges.filter((e) => e.to === `or:${orMatch.path}`).length : 0;

  const scripts = index.testScripts ?? index.testCases ?? [];
  const impactedTestCases = Math.min(
    scripts.length,
    Math.max(impactedKeywords, impactedOr) * 3 + (kwMatch ? 8 : 0)
  );

  const flows = (index.reusableFlows ?? []).filter(
    (f) =>
      kwMatch && f.relatedKeywords.some((k) => k.includes(kwMatch.className)) ||
      orMatch && f.relatedOrPaths.some((p) => p === orMatch.path)
  );

  const topDependencies: string[] = [];
  if (kwMatch) topDependencies.push(`Keyword: ${kwMatch.className}`);
  if (orMatch) topDependencies.push(`OR: ${orMatch.path}`);
  for (const f of flows.slice(0, 3)) topDependencies.push(`Flow: ${f.name}`);

  const riskScore = Math.min(
    99,
    Math.round(impactedTestCases * 1.2 + impactedOr * 2 + flows.length * 5)
  );

  return {
    impactedTestCases,
    impactedKeywords: kwMatch ? Math.max(1, impactedKeywords) : 0,
    impactedOrObjects: orMatch ? Math.max(1, impactedOr) : 0,
    impactedFlows: flows.length,
    riskScore,
    topDependencies,
  };
}
