/** Matches client ExecutionReportViewType — used for PDF export. */
export type ExecutionReportPdfType =
  | "execution"
  | "executive"
  | "release"
  | "severity"
  | "failures"
  | "modules"
  | "flows"
  | "flaky"
  | "rootCause"
  | "actionPlan"
  | "dashboard";

export const EXECUTION_REPORT_PDF_META: Record<
  ExecutionReportPdfType,
  { title: string; coverSubtitle: string; filenameSuffix: string }
> = {
  execution: {
    title: "Execution Intelligence Report",
    coverSubtitle: "Test execution metrics & quality snapshot",
    filenameSuffix: "execution-intelligence",
  },
  dashboard: {
    title: "Quality Dashboard Report",
    coverSubtitle: "Visual quality metrics & risk distribution",
    filenameSuffix: "quality-dashboard",
  },
  severity: {
    title: "Failure Severity Analysis",
    coverSubtitle: "Severity-weighted risk & critical failures",
    filenameSuffix: "severity-analysis",
  },
  failures: {
    title: "Failure Intelligence Report",
    coverSubtitle: "Module-clustered failure analysis",
    filenameSuffix: "failure-intelligence",
  },
  modules: {
    title: "Module Health Dashboard",
    coverSubtitle: "Per-module quality, stability & risk",
    filenameSuffix: "module-health",
  },
  flows: {
    title: "Business Flow Impact Report",
    coverSubtitle: "Critical business path risk assessment",
    filenameSuffix: "business-flow-impact",
  },
  flaky: {
    title: "Flaky Test Intelligence Report",
    coverSubtitle: "Stability trends & regression signals",
    filenameSuffix: "flaky-intelligence",
  },
  rootCause: {
    title: "Root Cause Analysis Report",
    coverSubtitle: "Categorized failure root-cause insights",
    filenameSuffix: "root-cause-analysis",
  },
  actionPlan: {
    title: "Engineering Action Plan",
    coverSubtitle: "Prioritized P0–P3 remediation roadmap",
    filenameSuffix: "engineering-action-plan",
  },
  release: {
    title: "Release Readiness Report",
    coverSubtitle: "Deployment readiness & governance decision",
    filenameSuffix: "release-readiness",
  },
  executive: {
    title: "Executive QA Intelligence Report",
    coverSubtitle: "Leadership quality assessment & deployment guidance",
    filenameSuffix: "executive-qa-intelligence",
  },
};

export function normalizeReportPdfType(raw?: string): ExecutionReportPdfType {
  if (raw && raw in EXECUTION_REPORT_PDF_META) return raw as ExecutionReportPdfType;
  return "execution";
}
