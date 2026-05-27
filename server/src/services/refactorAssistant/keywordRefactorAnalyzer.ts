import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectGraphV2 } from "../projectIntelligenceV2/types.js";
import type { KeywordProblemFinding, RefactorIssue } from "./types.js";

export function analyzeKeywordRefactoring(
  index: ProjectIndex,
  graph: ProjectGraphV2
): {
  keywordProblems: KeywordProblemFinding[];
  issues: RefactorIssue[];
  modularityScore: number;
} {
  const keywordProblems: KeywordProblemFinding[] = [];
  const issues: RefactorIssue[] = [];

  for (const id of graph.orphans.keywords) {
    const path = id.replace(/^kw:/, "");
    keywordProblems.push({
      path,
      className: path.split(".").pop() ?? path,
      problem: "Never called from indexed scripts",
      recommendation: "Remove or expose via shared setup keyword",
    });
  }

  const large = index.keywords.filter((k) => k.methods.length > 25);
  for (const k of large) {
    keywordProblems.push({
      path: k.customKeywordsPath,
      className: k.className,
      problem: `Large class (${k.methods.length} methods)`,
      recommendation: "Split by feature: LoginKeywords, NavigationKeywords, ApiKeywords",
    });
    issues.push({
      id: `kw-large-${k.className}`,
      category: "keyword",
      severity: k.methods.length > 40 ? "high" : "medium",
      confidence: 0.88,
      impactScore: 65,
      fixComplexity: "high",
      title: `Keyword class ${k.className} exceeds recommended size`,
      detail: `${k.methods.length} @Keyword methods — hard to navigate and test.`,
      whyItMatters: "God-class keywords become change bottlenecks for large teams.",
      affectedFiles: [k.filePath],
      suggestedSolution: "Extract cohesive groups into separate classes under the same package.",
      beforeExample: `class ${k.className} { /* 40+ methods */ }`,
      afterExample: "LoginKeywords.groovy + CheckoutKeywords.groovy + shared BaseKeyword.groovy",
    });
  }

  const rawDriver = index.keywords.filter((k) =>
    k.methods.some((m) => /driver\.|selenium|Actions\(/i.test(m.signature + m.semanticSummary))
  );
  if (rawDriver.length > 0) {
    issues.push({
      id: "kw-raw-selenium",
      category: "keyword",
      severity: "high",
      confidence: 0.8,
      impactScore: 70,
      fixComplexity: "medium",
      title: "Raw WebDriver/Selenium usage in keywords",
      detail: `${rawDriver.length} keyword class(es) may bypass Katalon WebUI abstractions.`,
      whyItMatters: "Direct driver calls break Katalon reporting and self-healing integration.",
      affectedFiles: rawDriver.map((k) => k.filePath),
      suggestedSolution: "Wrap in WebUI.* or Mobile.* APIs inside keywords only.",
    });
  }

  const used = index.keywords.length - graph.orphans.keywords.length;
  const modularityScore =
    index.keywords.length === 0 ? 100 : Math.round((used / index.keywords.length) * 100 - large.length * 5);

  return { keywordProblems, issues, modularityScore: Math.max(0, modularityScore) };
}
