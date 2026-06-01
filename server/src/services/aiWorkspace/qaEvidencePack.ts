import { analyzeProjectV2 } from "../projectIntelligenceV2/index.js";
import { runCoverageAnalysis } from "../coverageAnalyzer/index.js";
import { runRefactorAnalysis } from "../refactorAssistant/index.js";
import type { RoutedIntent } from "./intentRouter.js";
import { selectQaAgentsForRequest } from "./qaOrchestratorAgents.js";

export interface QaEvidenceGatherOptions {
  projectId?: string;
  swagger?: string;
  postmanCollection?: string;
  route: RoutedIntent;
  message: string;
  includeCoverage: boolean;
  includeRefactor: boolean;
  includeProjectAnalyze: boolean;
}

/** Structured facts for the Director — scores here are ALLOWED in section 2. */
export async function buildQaEvidencePack(opts: QaEvidenceGatherOptions): Promise<string> {
  if (!opts.projectId) {
    return `## EVIDENCE PACK
No active project — all dashboard metrics must be **Unknown** (confidence 0%) unless user provided data in the message.
Historical trend: No historical data available.`;
  }

  const lines: string[] = ["## EVIDENCE PACK (use ONLY these facts — do not invent others)"];

  const tasks: Promise<void>[] = [];

  if (opts.includeProjectAnalyze) {
    tasks.push(
      (async () => {
        try {
          const a = await analyzeProjectV2(opts.projectId!, {
            healScripts: true,
            healLocators: true,
            generateDocumentation: false,
          });
          lines.push(
            "### Project Intelligence v2 (analyzer)",
            `- Project risk score: ${a.insights.riskScore}/100 (source: project analyze)`,
            `- Flaky tests flagged: ${a.insights.flakyTests.length} (source: project analyze)`,
            `- Script fixes proposed (changed): ${a.fixes.testCases.filter((t) => t.changed).length}`,
            `- OR healing proposals: ${a.fixes.objectRepository.length}`,
            a.insights.flakyTests.length
              ? `- Flaky test names (sample): ${a.insights.flakyTests.slice(0, 8).join("; ")}`
              : "",
            a.warnings.length ? `- Warnings: ${a.warnings.join(" · ")}` : ""
          );
        } catch (e) {
          lines.push(
            `### Project Intelligence v2`,
            `- Error: ${e instanceof Error ? e.message : String(e)}`
          );
        }
      })()
    );
  }

  if (opts.includeCoverage) {
    tasks.push(
      (async () => {
        try {
          const c = await runCoverageAnalysis({
            projectId: opts.projectId!,
            swagger: opts.swagger,
            postmanCollection: opts.postmanCollection,
            forceRefresh: false,
          });
          const unusedOr = c.unusedAssets.filter((u) => u.kind === "test_object").length;
          const unusedKw = c.unusedAssets.filter((u) => u.kind === "keyword").length;
          lines.push(
            "### Coverage Analyzer (analyzer)",
            `- Overall coverage score: ${c.overallCoverage} (source: coverage analyzer)`,
            `- Risk score: ${c.riskScore}/100 (source: coverage analyzer)`,
            `- Maintainability score: ${c.maintainabilityScore} (source: coverage analyzer)`,
            `- Weak assertion scripts: ${c.weakAssertions.length}`,
            `- Unused OR assets: ${unusedOr}`,
            `- Unused keywords: ${unusedKw}`,
            `- Duplicate flows: ${c.duplicateFlows.length}`,
            `- Missing scenarios: ${c.missingScenarioCount}`,
            `- Top recommendations: ${c.recommendations.slice(0, 3).map((r) => r.title).join("; ") || "none"}`
          );
        } catch (e) {
          lines.push(`### Coverage Analyzer`, `- Not available: ${e instanceof Error ? e.message : String(e)}`);
        }
      })()
    );
  }

  if (opts.includeRefactor) {
    tasks.push(
      (async () => {
        try {
          const r = await runRefactorAnalysis({
            projectId: opts.projectId!,
            forceRefresh: false,
          });
          const waitIssues = r.issues.filter((i) => i.category === "wait").length;
          lines.push(
            "### Refactoring Analyzer (analyzer)",
            `- Maintainability score: ${r.maintainabilityScore} (source: refactor analyzer)`,
            `- Framework health score: ${r.frameworkHealthScore} (source: refactor analyzer)`,
            `- Duplication score: ${r.duplicationScore} (source: refactor analyzer)`,
            `- Wait stability score: ${r.waitStabilityScore} (source: refactor analyzer)`,
            `- Wait-related issues: ${waitIssues}`,
            `- Top recommendations: ${r.recommendations.slice(0, 3).map((x) => x.title).join("; ") || "none"}`
          );
        } catch (e) {
          lines.push(`### Refactoring Analyzer`, `- Not available: ${e instanceof Error ? e.message : String(e)}`);
        }
      })()
    );
  }

  await Promise.all(tasks);

  lines.push(
    "### Historical trend",
    "No historical release comparison in this session unless conversation memory cites prior runs.",
    "",
    "### Dashboard mapping rules",
    "- **Coverage Score**: use Coverage Analyzer overall coverage if present; else Unknown.",
    "- **Stability / Automation Quality**: use Refactor maintainability/framework health if present; else Unknown.",
    "- **Flakiness**: use Project Analyze flaky count / list if present; else Unknown.",
    "- **Release Readiness**: Release Risk Agent synthesizes from findings only — do not invent a numeric score without execution report data."
  );

  return lines.filter(Boolean).join("\n");
}

export function evidenceGatherFlags(
  route: RoutedIntent,
  message: string,
  projectId?: string
): Pick<QaEvidenceGatherOptions, "includeCoverage" | "includeRefactor" | "includeProjectAnalyze"> {
  if (!projectId) {
    return { includeCoverage: false, includeRefactor: false, includeProjectAnalyze: false };
  }
  const agents = selectQaAgentsForRequest(route, message);
  const analyzeLike =
    route.intent === "analyze" ||
    route.intent === "review" ||
    route.intent === "optimize" ||
    /\b(review|analyze|audit|coverage|refactor|risk)\b/i.test(message);

  return {
    includeProjectAnalyze: analyzeLike || agents.includes("flaky") || agents.includes("release_risk"),
    includeCoverage: analyzeLike || agents.includes("coverage"),
    includeRefactor: analyzeLike || agents.includes("security_quality") || route.intent === "optimize",
  };
}
