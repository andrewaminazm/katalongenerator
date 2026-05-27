import type { ProjectIndex } from "../projectIntelligence/types.js";
import type {
  DocumentationSections,
  ObjectRepositoryFix,
  ProjectGraphV2,
  ProjectInsights,
  TestCaseFix,
} from "./types.js";
import { scoreOrObject } from "./orAnalyzer.js";

function moduleFromPath(p: string): string {
  const parts = p.split("/");
  return parts.length > 1 ? parts[0] : "General";
}

export function generateDocumentation(
  index: ProjectIndex,
  graph: ProjectGraphV2,
  insights: ProjectInsights,
  scriptFixes: TestCaseFix[],
  orFixes: ObjectRepositoryFix[]
): DocumentationSections {
  const scripts = index.testScripts ?? index.testCases ?? [];
  const modules = new Map<string, number>();
  for (const s of scripts) {
    const mod = moduleFromPath(s.logicalPath);
    modules.set(mod, (modules.get(mod) ?? 0) + 1);
  }

  const overview = `# ${index.projectName} — Project Overview

**Indexed:** ${index.uploadDate}  
**Source:** ${index.sourceType}

## Architecture summary

| Asset | Count |
|-------|------:|
| Test scripts | ${index.stats.testScripts} |
| Object Repository | ${index.stats.testObjects} |
| Custom Keywords | ${index.stats.keywords} (${index.stats.keywordMethods} methods) |
| Test Suites | ${index.stats.testSuites} |
| Profiles | ${index.stats.profiles} |

This project uses **${insights.styleProfile[0] ?? "standard Katalon"}** patterns. Project Intelligence risk score: **${insights.riskScore}/100**.
`;

  const covered = [...modules.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([m, c]) => `- **${m}**: ${c} script(s)`)
    .join("\n");

  const coverageMap = `# Test Coverage Map

## Modules detected

${covered || "_No module folders detected_"}

## Reusable flows

${(index.reusableFlows ?? []).slice(0, 10).map((f) => `- ${f.name}: ${f.description}`).join("\n") || "_None detected_"}

## Gaps (heuristic)

- Orphan test objects: ${graph.orphans.testObjects.length}
- Duplicate flows: ${graph.duplicates.flows.length}
`;

  const orScores = index.testObjects
    .map((o) => ({ path: o.path, ...scoreOrObject(o) }))
    .sort((a, b) => a.stabilityScore - b.stabilityScore)
    .slice(0, 15);

  const objectRepositoryGuide = `# Object Repository Guide

## Naming conventions

- Prefer \`PageName/element_role\` folder structure under Object Repository
- Labels should be snake_case or camelCase without spaces

## Locator strategy (priority)

1. **id** — stable element ids  
2. **name** — form fields  
3. **accessibility** — aria / content-desc where available  
4. **css** — short, semantic classes  
5. **xpath** — last resort; avoid \`/html/...\` absolute paths

## Lowest stability scores

${orScores.map((o) => `- \`${o.orPath}\` — score ${o.stabilityScore} (${o.issues.join(", ") || "ok"})`).join("\n")}

## Healing proposals

${orFixes.slice(0, 10).map((f) => `- \`${f.orPath}\`: ${f.oldLocator.type} → ${f.newLocator.type} (${f.reason})`).join("\n") || "_No locator upgrades suggested_"}
`;

  const keywordLibraryGuide = `# Keyword Library Guide

## Indexed classes (${index.keywords.length})

${index.keywords
  .slice(0, 20)
  .map(
    (k) =>
      `### ${k.className}\n- Path: \`${k.customKeywordsPath}\`\n- Methods: ${k.methods.map((m) => m.name).join(", ")}`
  )
  .join("\n\n")}

## Recommended usage

- Call via \`CustomKeywords.'package.Class.method(args)'\`
- Keep UI actions in keywords; keep test cases as orchestration + assertions
`;

  const testExecutionGuide = `# Test Execution Guide

## Katalon Studio

1. Open the project folder (or re-import from uploaded archive)
2. Select **Test Suites** under \`Test Suites/\` (${index.stats.testSuites} indexed)
3. Run with target **execution profile** from \`Profiles/\`

## CI/CD notes

- Export command-line execution via Katalon Runtime Engine
- Pin browser drivers and profiles per environment
- Store secrets in profile globals, not in scripts

## After healing

${scriptFixes.filter((f) => f.changed).length} script(s) have proposed fixes — review diffs before commit.
`;

  const flakyRiskReport = `# Flaky Risk Report

**Project risk score:** ${insights.riskScore}/100

## High-risk scripts

${insights.flakyTests
  .slice(0, 15)
  .map((t) => `- \`${t.logicalPath}\` — risk ${t.riskScore}: ${t.reasons.join("; ")}`)
  .join("\n") || "_None flagged_"}

## Recommendations

${insights.refactoringHints.map((h) => `- ${h}`).join("\n")}
`;

  return {
    overview,
    coverageMap,
    objectRepositoryGuide,
    keywordLibraryGuide,
    testExecutionGuide,
    flakyRiskReport,
  };
}

export function sectionsToMarkdown(sections: DocumentationSections): string {
  return [
    sections.overview,
    "---",
    sections.coverageMap,
    "---",
    sections.objectRepositoryGuide,
    "---",
    sections.keywordLibraryGuide,
    "---",
    sections.testExecutionGuide,
    "---",
    sections.flakyRiskReport,
  ].join("\n\n");
}
