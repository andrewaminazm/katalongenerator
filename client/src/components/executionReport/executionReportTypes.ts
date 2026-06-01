export type ExecutionReportViewType =
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

export interface ExecutionReportTypeOption {
  id: ExecutionReportViewType;
  label: string;
  shortLabel: string;
  description: string;
  /** Group for optional visual separation in tab bar */
  group: "overview" | "analysis" | "leadership";
}

export const EXECUTION_REPORT_TYPES: ExecutionReportTypeOption[] = [
  {
    id: "execution",
    label: "Execution Intelligence",
    shortLabel: "Execution",
    description: "Pass/fail metrics, CI context, stability, and high-level execution snapshot.",
    group: "overview",
  },
  {
    id: "dashboard",
    label: "Quality Dashboard",
    shortLabel: "Dashboard",
    description: "Visual charts for pass/fail, severity distribution, and module risk.",
    group: "overview",
  },
  {
    id: "severity",
    label: "Severity Analysis",
    shortLabel: "Severity",
    description: "CRITICAL/HIGH/MEDIUM/LOW breakdown, weighted risk, and critical failure table.",
    group: "analysis",
  },
  {
    id: "failures",
    label: "Failure Intelligence",
    shortLabel: "Failures",
    description: "Failures clustered by module with impact — no per-test laundry list in executive style.",
    group: "analysis",
  },
  {
    id: "modules",
    label: "Module Health",
    shortLabel: "Modules",
    description: "Per-module quality, stability, risk, and dominant failure type (healthiest → riskiest).",
    group: "analysis",
  },
  {
    id: "flows",
    label: "Business Flow Impact",
    shortLabel: "Flows",
    description: "Auth, checkout, payment, and other business-critical flow risk.",
    group: "analysis",
  },
  {
    id: "flaky",
    label: "Flaky Test Intelligence",
    shortLabel: "Flaky",
    description: "Flaky candidates, repeated signals, regression hints, and stability trend.",
    group: "analysis",
  },
  {
    id: "rootCause",
    label: "Root Cause Analysis",
    shortLabel: "Root cause",
    description: "UI, API, timing, and environment root-cause categories ranked by likelihood.",
    group: "analysis",
  },
  {
    id: "actionPlan",
    label: "Engineering Action Plan",
    shortLabel: "Actions",
    description: "P0–P3 prioritized engineering actions and release blockers.",
    group: "leadership",
  },
  {
    id: "release",
    label: "Release Readiness",
    shortLabel: "Release",
    description: "Readiness score, blocking issues, director status, and deployment decision.",
    group: "leadership",
  },
  {
    id: "executive",
    label: "Executive QA Intelligence",
    shortLabel: "Executive",
    description: "Full 12-section leadership report with scorecard and deployment recommendation.",
    group: "leadership",
  },
];

export function getReportTypeOption(id: ExecutionReportViewType): ExecutionReportTypeOption | undefined {
  return EXECUTION_REPORT_TYPES.find((t) => t.id === id);
}

const PDF_FILENAME_SUFFIX: Record<ExecutionReportViewType, string> = {
  execution: "execution-intelligence",
  dashboard: "quality-dashboard",
  severity: "severity-analysis",
  failures: "failure-intelligence",
  modules: "module-health",
  flows: "business-flow-impact",
  flaky: "flaky-intelligence",
  rootCause: "root-cause-analysis",
  actionPlan: "engineering-action-plan",
  release: "release-readiness",
  executive: "executive-qa-intelligence",
};

export function reportTypePdfFilename(
  projectName: string,
  buildId: string,
  type: ExecutionReportViewType
): string {
  const safe = `${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${buildId}`;
  return `${safe}-${PDF_FILENAME_SUFFIX[type]}.pdf`;
}

export function reportTypeApiFlags(type: ExecutionReportViewType): {
  includeExecutiveIntelligence: boolean;
  preferAiNarrative: boolean;
} {
  if (type === "executive") {
    return { includeExecutiveIntelligence: true, preferAiNarrative: true };
  }
  if (type === "release") {
    return { includeExecutiveIntelligence: true, preferAiNarrative: false };
  }
  if (type === "execution") {
    return { includeExecutiveIntelligence: false, preferAiNarrative: false };
  }
  return { includeExecutiveIntelligence: true, preferAiNarrative: false };
}
