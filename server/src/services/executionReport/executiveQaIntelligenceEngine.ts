import { gosiBrainGenerate, stripGosiBrainCoT } from "../gosiBrain.js";
import { SENIOR_QA_ENGINEER_NAME } from "../aiWorkspace/gosiBrainIdentity.js";
import { buildExecutionIntelligenceEvidence } from "./executionIntelligenceEvidence.js";
import {
  EXECUTIVE_QA_INTELLIGENCE_PROMPT,
  EXECUTIVE_QA_INTELLIGENCE_REMINDER,
} from "./executiveQaIntelligencePrompt.js";
import type { DeploymentRecommendation, ExecutionReportInput, ExecutionReportOutput } from "./types.js";

export type DirectorStatus = "READY" | "AT RISK" | "BLOCKED" | "CRITICAL";

export interface ExecutiveIntelligenceResult {
  markdown: string;
  directorStatus: DirectorStatus;
  deploymentRecommendation: DeploymentRecommendation;
  generatedBy: "deterministic" | "gosi_brain";
  model?: string;
}

function deriveDirectorStatus(report: ExecutionReportOutput): DirectorStatus {
  const es = report.executiveSummary;
  const critical = es.severityCounts.CRITICAL ?? 0;
  const pass = es.passRatePercent;
  if (critical >= 3 || pass < 50) return "CRITICAL";
  if (report.releaseReadiness.status === "BLOCKED") return "BLOCKED";
  if (report.releaseReadiness.status === "AT_RISK") return "AT RISK";
  return "READY";
}

function deriveDeploymentRecommendation(
  report: ExecutionReportOutput,
  director: DirectorStatus
): DeploymentRecommendation {
  const es = report.executiveSummary;
  const rr = report.releaseReadiness;
  const critical = es.severityCounts.CRITICAL ?? 0;

  if (director === "CRITICAL" || (director === "BLOCKED" && critical > 0)) {
    return {
      decision: "Block Release",
      reasoning: `${critical} critical failure(s) and readiness score ${rr.score}/100 — production exposure is unacceptable.`,
      confidencePercent: rr.confidencePercent,
      majorRisks: rr.blockingIssues.length ? rr.blockingIssues : ["Critical severity failures in this snapshot"],
      requiredActions: report.recommendations.slice(0, 5),
    };
  }
  if (director === "BLOCKED") {
    return {
      decision: "Do Not Deploy",
      reasoning: `Release readiness BLOCKED (score ${rr.score}/100). Resolve blocking issues before any production path.`,
      confidencePercent: rr.confidencePercent,
      majorRisks: rr.blockingIssues,
      requiredActions: report.recommendations.slice(0, 5),
    };
  }
  if (director === "AT RISK") {
    return {
      decision: "Deploy To Staging Only",
      reasoning: `Pass rate ${es.passRatePercent}% with elevated risk — validate in staging with targeted regression before production.`,
      confidencePercent: rr.confidencePercent,
      majorRisks: rr.blockingIssues.length ? rr.blockingIssues : ["Elevated HIGH/MEDIUM severity pattern"],
      requiredActions: report.recommendations.slice(0, 4),
    };
  }
  if (es.failed > 0) {
    return {
      decision: "Deploy With Monitoring",
      reasoning: `Readiness READY with ${es.failed} failure(s) — deploy only with monitoring on affected modules and rollback plan.`,
      confidencePercent: rr.confidencePercent,
      majorRisks: ["Residual failures may indicate latent defects"],
      requiredActions: ["Monitor auth/payment/checkout if present in failure set", ...report.recommendations.slice(0, 2)],
    };
  }
  return {
    decision: "Deploy",
    reasoning: `No blocking severity pattern; pass rate ${es.passRatePercent}% and readiness score ${rr.score}/100.`,
    confidencePercent: rr.confidencePercent,
    majorRisks: [],
    requiredActions: ["Continue trend monitoring on next nightly run"],
  };
}

function mapFailureTypeToRootCause(
  tests: ExecutionReportInput["failedTests"]
): Array<{ category: string; count: number }> {
  const buckets: Record<string, number> = {
    "Locator Issues": 0,
    "Application Defects": 0,
    "Environment Problems": 0,
    "Data Issues": 0,
    "Framework Problems": 0,
    "Timing Problems": 0,
    "Configuration Issues": 0,
  };
  for (const t of tests ?? []) {
    const msg = (`${t.errorMessage ?? ""}${t.stackTraceSummary ?? ""}`).toLowerCase();
    const type = String(t.failureType ?? "").toUpperCase();
    if (type === "UI" || /element not found|locator|selector|xpath/i.test(msg)) {
      buckets["Locator Issues"]!++;
    } else if (type === "ENVIRONMENT" || /503|connection|environment|timeout.*service/i.test(msg)) {
      buckets["Environment Problems"]!++;
    } else if (type === "DATA") buckets["Data Issues"]!++;
    else if (type === "TIMEOUT" || /timeout|stale|wait/i.test(msg)) buckets["Timing Problems"]!++;
    else if (type === "ASSERTION") buckets["Application Defects"]!++;
    else if (type === "API" || /500|400|401|api/i.test(msg)) buckets["Application Defects"]!++;
    else buckets["Application Defects"]!++;
  }
  return Object.entries(buckets)
    .filter(([, c]) => c > 0)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildDeterministicExecutiveReport(
  input: ExecutionReportInput,
  report: ExecutionReportOutput
): ExecutiveIntelligenceResult {
  const es = report.executiveSummary;
  const eo = report.executionOverview;
  const rr = report.releaseReadiness;
  const director = deriveDirectorStatus(report);
  const deployment = deriveDeploymentRecommendation(report, director);

  const byModule = new Map<string, number>();
  for (const t of input.failedTests ?? []) {
    byModule.set(t.module, (byModule.get(t.module) ?? 0) + 1);
  }
  const clusters = [...byModule.entries()].sort((a, b) => b[1] - a[1]);
  const rootCauseRows = mapFailureTypeToRootCause(input.failedTests);

  const lines: string[] = [
    `# AI Executive QA Intelligence Report`,
    "",
    `*Prepared by ${SENIOR_QA_ENGINEER_NAME} — deterministic intelligence from execution snapshot*`,
    "",
    "## SECTION 1 — EXECUTIVE SUMMARY",
    "",
    `- **Overall quality:** Pass rate **${es.passRatePercent}%** across **${es.totalTestCases}** tests (${es.failed} failed). **Confidence: ${rr.confidencePercent}%** — *Source: scoring engine*`,
    `- **Release posture:** ${director} — structured readiness **${rr.status}** (score ${rr.score}/100).`,
    `- **Major risk:** ${clusters[0] ? `${clusters[0][0]} module (${clusters[0][1]} failures)` : "No failures recorded"} — business impact on dependent flows.`,
    `- **Stability:** Score **${eo.stabilityScore}/100**; risk score **${eo.riskScore}/100**.`,
    `- **Severity:** ${es.severityCounts.CRITICAL ?? 0} CRITICAL, ${es.severityCounts.HIGH ?? 0} HIGH — ${es.severityCounts.CRITICAL ? "blocks production confidence" : "within tolerable band for staging validation"}.`,
    `- **Environment:** ${input.environment} — confirm parity before comparing to production behavior.`,
    `- **Improvement:** Address top module ${clusters[0]?.[0] ?? "N/A"} and re-run targeted regression.`,
    `- **Critical concern:** ${rr.blockingIssues[0] ?? (es.failed ? `${es.failed} failures require triage` : "None in this snapshot")}.`,
    `- **Recommendation:** ${deployment.decision} — see Section 12.`,
    "",
    "## SECTION 2 — QA DIRECTOR ASSESSMENT",
    "",
    `**Status: ${director}**`,
    "",
    "**Quality Assessment** — ",
    es.passRatePercent >= 85
      ? "Acceptable functional coverage signal for this run; failures are localized."
      : "Material quality gap — failure volume or severity threatens release confidence.",
    ` *Confidence: ${rr.confidencePercent}% — evidence: pass rate, severity counts.*`,
    "",
    "**Engineering Assessment** — ",
    (es.severityCounts.CRITICAL ?? 0) > 0
      ? "Critical defects likely require application or integration fixes, not test-only patches."
      : "Failures appear addressable through stabilization and environment validation.",
    "",
    "**Automation Assessment** — ",
    rootCauseRows.some((r) => r.category === "Locator Issues")
      ? "Locator/UI instability detected — strengthen object repository and waits."
      : "No dominant locator pattern; automation suite structure appears sound for this snapshot.",
    "",
    "**Release Assessment** — ",
    es.releaseStatement,
    "",
    "**Recommendations:** Prioritize P0 items in Section 11; hold production until Section 12 criteria met.",
    "",
    "## SECTION 3 — QUALITY SCORECARD",
    "",
    `| Metric | Score | Confidence | Evidence |`,
    `|--------|-------|------------|----------|`,
    `| Stability | ${eo.stabilityScore} | ${rr.confidencePercent}% | Pass ${es.passRatePercent}%, severity-weighted penalty |`,
    `| Execution Reliability | ${rr.score} | ${rr.confidencePercent}% | Readiness score; ${es.failed} failures |`,
    `| Release Readiness | ${rr.score} | ${rr.confidencePercent}% | Status ${rr.status}; blocking: ${rr.blockingIssues.length} |`,
    `| Coverage | Unknown | 0% | No coverage analyzer attached to this report |`,
    `| Automation Health | ${Math.max(0, 100 - eo.riskScore)} | 70% | Risk score inverse proxy from failure weights |`,
    `| Assertion Quality | Unknown | 0% | No assertion analyzer run |`,
    `| Flakiness | ${report.flakyInsights.stabilityTrend === "stable" ? "85" : report.flakyInsights.stabilityTrend === "degrading" ? "45" : "60"} | 65% | Trend: ${report.flakyInsights.stabilityTrend}; ${report.flakyInsights.flakyCandidates.length} flaky candidates |`,
    "",
    "## SECTION 4 — RELEASE READINESS",
    "",
    `**${director}** (structured engine: **${rr.status}**, score **${rr.score}/100**)`,
    "",
    `- Critical failures: **${es.severityCounts.CRITICAL ?? 0}**`,
    `- High severity: **${es.severityCounts.HIGH ?? 0}**`,
    `- Business flows: ${report.businessFlowImpact.summary}`,
    `- Environment: **${input.environment}** — validate health if ENVIRONMENT failures present`,
    `- Automation confidence: **${rr.confidencePercent}%** based on pass rate and severity weighting`,
    "",
    "**Recommendations:** " + (rr.blockingIssues[0] ?? "Proceed per Section 12 deployment decision."),
    "",
    "## SECTION 5 — FAILURE INTELLIGENCE",
    "",
  ];

  if (clusters.length === 0) {
    lines.push("_No failure clusters — clean execution snapshot._", "");
  } else {
    for (const [mod, count] of clusters) {
      const modRow = report.moduleRiskAnalysis.modules.find((m) => m.module === mod);
      lines.push(
        `### ${mod} Failures`,
        `- **Count:** ${count}`,
        `- **Impact:** ${modRow ? `Risk score ${modRow.riskScore}` : "Module-level impact unranked"}`,
        `- **Risk:** ${modRow && modRow.riskScore >= 50 ? "High" : "Medium"}`,
        `- **Root cause (signal):** ${modRow?.dominantFailureType ?? "See Section 6"}`,
        ""
      );
    }
  }

  lines.push("## SECTION 6 — ROOT CAUSE ANALYSIS", "");
  if (rootCauseRows.length === 0) {
    lines.push("_No failures to categorize._", "");
  } else {
    for (const row of rootCauseRows) {
      lines.push(
        `### ${row.category}`,
        `- **Count:** ${row.count}`,
        `- **Impact:** ${row.count >= 3 ? "High" : "Medium"}`,
        `- **Confidence:** 75%`,
        `- **Evidence:** Derived from failureType and errorMessage patterns in submitted failedTests`,
        ""
      );
    }
  }

  lines.push(
    "## SECTION 7 — QUALITY TREND INTELLIGENCE",
    "",
    "**Historical trend data unavailable.** No prior execution snapshots were supplied with this report.",
    "",
    "| Trend | Status |",
    "|-------|--------|",
    `| Pass rate | Unchanged (single snapshot) |`,
    `| Failure volume | Unchanged (single snapshot) |`,
    `| Flaky | ${report.flakyInsights.stabilityTrend} (in-run signal only) |`,
    "",
    "**Recommendations:** Store build-over-build results to enable trend scoring.",
    "",
    "## SECTION 8 — BUG PREDICTION INTELLIGENCE",
    ""
  );

  const highRiskModules = report.moduleRiskAnalysis.modules.filter((m) => m.riskScore >= 40).slice(0, 5);
  if (highRiskModules.length === 0) {
    lines.push(
      "**Insufficient evidence** for module-level production escape prediction beyond this single run.",
      ""
    );
  } else {
    for (const m of highRiskModules) {
      lines.push(
        `### ${m.module}`,
        `- **Risk Level:** ${m.riskScore >= 70 ? "High" : "Medium"}`,
        `- **Production Escape Risk:** ${/payment|auth|checkout|login/i.test(m.module) ? "Elevated" : "Moderate"}`,
        `- **Confidence:** 72%`,
        `- **Evidence:** ${m.failureCount} failures; dominant type ${m.dominantFailureType}`,
        ""
      );
    }
  }

  lines.push("## SECTION 9 — MODULE HEALTH DASHBOARD", "");
  const sortedModules = [...report.moduleRiskAnalysis.modules].sort((a, b) => a.riskScore - b.riskScore);
  if (sortedModules.length === 0) {
    lines.push("_No module failures — all modules healthy in this snapshot._", "");
  } else {
    lines.push("| Module | Quality | Pass est. | Stability | Risk | Confidence |");
    lines.push("|--------|---------|-----------|-----------|------|------------|");
    for (const m of sortedModules) {
      const quality = Math.max(0, 100 - m.riskScore);
      lines.push(
        `| ${m.module} | ${quality} | n/a | ${m.stabilityScore} | ${m.riskScore >= 50 ? "High" : "Low"} | 80% |`
      );
    }
    lines.push("");
  }

  lines.push("## SECTION 10 — FLAKY TEST INTELLIGENCE", "");
  if (report.flakyInsights.flakyCandidates.length === 0) {
    lines.push("_No flaky candidates identified from error patterns._", "");
  } else {
    for (const name of report.flakyInsights.flakyCandidates) {
      lines.push(
        `### ${name}`,
        `- **Flakiness Score:** 65`,
        `- **Failure Frequency:** Listed in failure set`,
        `- **Retry Success Pattern:** Unknown (no retry history in input)`,
        `- **Likely Cause:** Timeout/intermittent or LOW severity classification`,
        `- **Recommended Fix:** Stabilize waits; quarantine until 3 consecutive greens`,
        ""
      );
    }
  }

  lines.push("## SECTION 11 — ENGINEERING ACTION PLAN", "");
  let p0 = 0;
  if ((es.severityCounts.CRITICAL ?? 0) > 0) {
    lines.push(
      "### P0 — Release Blockers",
      `- **Priority:** P0 | **Impact:** Blocks release | **Effort:** 1–3 days | **Recommendation:** Resolve ${es.severityCounts.CRITICAL} CRITICAL failure(s) and re-run smoke on affected modules.`,
      ""
    );
    p0++;
  }
  lines.push("### P1 — Critical Improvements");
  for (const rec of report.recommendations.slice(0, 3)) {
    lines.push(`- **Priority:** P1 | **Impact:** High | **Effort:** Medium | **Recommendation:** ${rec}`);
  }
  if (p0 === 0 && report.recommendations.length === 0) {
    lines.push("- _No P1 items — maintain monitoring._");
  }
  lines.push("", "### P2 — High Value Improvements", "- Stabilize top failing module automation and add API contract checks where API failures exist.", "", "### P3 — Optimization", "- Enable historical trend storage for Section 7 automation.", "");

  lines.push(
    "## SECTION 12 — DEPLOYMENT RECOMMENDATION",
    "",
    `### **${deployment.decision}**`,
    "",
    `**Reasoning:** ${deployment.reasoning}`,
    "",
    `**Confidence:** ${deployment.confidencePercent}%`,
    "",
    "**Major Risks:**",
    ...(deployment.majorRisks.length ? deployment.majorRisks.map((r) => `- ${r}`) : ["- None identified"]),
    "",
    "**Required Actions:**",
    ...deployment.requiredActions.map((a) => `- ${a}`),
    ""
  );

  return {
    markdown: lines.join("\n"),
    directorStatus: director,
    deploymentRecommendation: deployment,
    generatedBy: "deterministic",
  };
}

export async function generateExecutiveQaIntelligence(
  input: ExecutionReportInput,
  report: ExecutionReportOutput,
  opts?: { authorizationToken?: string; model?: string; preferAi?: boolean }
): Promise<ExecutiveIntelligenceResult> {
  const fallback = buildDeterministicExecutiveReport(input, report);
  if (opts?.preferAi === false) return fallback;

  const evidence = buildExecutionIntelligenceEvidence(input, report);
  const prompt = `${EXECUTIVE_QA_INTELLIGENCE_PROMPT}

${evidence}

${EXECUTIVE_QA_INTELLIGENCE_REMINDER}`;

  const token =
    opts?.authorizationToken?.trim() || process.env.GOSI_BRAIN_AUTHORIZATION_TOKEN?.trim();
  if (!token) return fallback;

  try {
    const { response, model } = await gosiBrainGenerate({
      prompt,
      model: opts?.model,
      authorizationToken: token,
    });
    const markdown = stripGosiBrainCoT(response).trim();
    if (markdown.length < 400) return fallback;
    return {
      markdown,
      directorStatus: fallback.directorStatus,
      deploymentRecommendation: fallback.deploymentRecommendation,
      generatedBy: "gosi_brain",
      model,
    };
  } catch {
    return fallback;
  }
}
