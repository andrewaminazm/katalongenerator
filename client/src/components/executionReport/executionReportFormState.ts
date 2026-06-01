import type { ExecutionReportInput } from "../../api";
import { reportTypeApiFlags, type ExecutionReportViewType } from "./executionReportTypes";

export type FailureSeverityOption = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type FailureTypeOption = "UI" | "API" | "ASSERTION" | "TIMEOUT" | "DATA";

export interface FailureRowState {
  id: string;
  testCaseName: string;
  module: string;
  errorMessage: string;
  failureType: FailureTypeOption;
  failureSeverity: FailureSeverityOption;
}

export interface ExecutionFormState {
  projectName: string;
  buildId: string;
  executionDate: string;
  environment: string;
  totalTestCases: string;
  passed: string;
  failed: string;
  skipped: string;
  duration: string;
  pipelineName: string;
  branch: string;
  failureRows: FailureRowState[];
}

export const EMPTY_FAILURE_ROW = (): FailureRowState => ({
  id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  testCaseName: "",
  module: "",
  errorMessage: "",
  failureType: "UI",
  failureSeverity: "HIGH",
});

export const DEFAULT_FORM_STATE = (): ExecutionFormState => ({
  projectName: "",
  buildId: "",
  executionDate: "",
  environment: "",
  totalTestCases: "",
  passed: "",
  failed: "",
  skipped: "",
  duration: "",
  pipelineName: "",
  branch: "",
  failureRows: [],
});

export function formStateFromSample(sample: ExecutionReportInput): ExecutionFormState {
  return {
    projectName: sample.projectName,
    buildId: sample.buildId,
    executionDate: sample.executionDate,
    environment: sample.environment,
    totalTestCases: String(sample.testExecution.totalTestCases),
    passed: String(sample.testExecution.passed),
    failed: String(sample.testExecution.failed),
    skipped: String(sample.testExecution.skipped),
    duration: sample.testExecution.duration,
    pipelineName: sample.pipelineName ?? "",
    branch: sample.branch ?? "",
    failureRows: (sample.failedTests ?? []).map((t) => ({
      id: `row-${Math.random().toString(36).slice(2, 8)}`,
      testCaseName: t.testCaseName,
      module: t.module,
      errorMessage: t.errorMessage,
      failureType: (t.failureType?.toUpperCase() as FailureTypeOption) || "UI",
      failureSeverity: (t.failureSeverity?.toUpperCase() as FailureSeverityOption) || "HIGH",
    })),
  };
}

function parseCount(value: string, label: string): number {
  const n = Number(value);
  if (value.trim() === "" || Number.isNaN(n) || n < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return Math.floor(n);
}

export function buildInputFromForm(
  form: ExecutionFormState,
  reportType: ExecutionReportViewType = "execution"
): ExecutionReportInput {
  if (!form.projectName.trim()) throw new Error("Project name is required");
  if (!form.buildId.trim()) throw new Error("Build ID is required");
  if (!form.executionDate.trim()) throw new Error("Execution date is required");

  const total = parseCount(form.totalTestCases, "Total test cases");
  const passed = parseCount(form.passed, "Passed");
  const failed = parseCount(form.failed, "Failed");
  const skipped = form.skipped.trim() === "" ? 0 : parseCount(form.skipped, "Skipped");

  if (passed + failed + skipped > total) {
    throw new Error("Passed + failed + skipped cannot exceed total test cases");
  }

  const failedTests = form.failureRows
    .filter((r) => r.testCaseName.trim() || r.errorMessage.trim())
    .map((r) => ({
      testCaseName: r.testCaseName.trim() || "Unnamed test",
      module: r.module.trim() || "General",
      errorMessage: r.errorMessage.trim() || "No error message provided",
      failureType: r.failureType,
      failureSeverity: r.failureSeverity,
    }));

  const flags = reportTypeApiFlags(reportType);

  return {
    projectName: form.projectName.trim(),
    buildId: form.buildId.trim(),
    executionDate: form.executionDate.trim(),
    environment: form.environment.trim() || "QA",
    testExecution: {
      totalTestCases: total,
      passed,
      failed,
      skipped,
      duration: form.duration.trim() || "—",
    },
    failedTests,
    pipelineName: form.pipelineName.trim() || undefined,
    branch: form.branch.trim() || undefined,
    includeExecutiveIntelligence: flags.includeExecutiveIntelligence,
    preferAiNarrative: flags.preferAiNarrative,
    reportType,
  };
}
