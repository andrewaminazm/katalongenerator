import type { ExecutionReportOutput } from "../../api";
import type { ExecutionReportViewType } from "./executionReportTypes";
import { ExecutionReportActionPlanView } from "./ExecutionReportActionPlanView";
import { ExecutionReportDashboardView } from "./ExecutionReportDashboardView";
import { ExecutionReportExecutionView } from "./ExecutionReportExecutionView";
import { ExecutionReportExecutiveView } from "./ExecutionReportExecutiveView";
import { ExecutionReportFailuresView } from "./ExecutionReportFailuresView";
import { ExecutionReportFlakyView } from "./ExecutionReportFlakyView";
import { ExecutionReportFlowsView } from "./ExecutionReportFlowsView";
import { ExecutionReportModulesView } from "./ExecutionReportModulesView";
import { ExecutionReportReleaseView } from "./ExecutionReportReleaseView";
import { ExecutionReportRootCauseView } from "./ExecutionReportRootCauseView";
import { ExecutionReportSeverityView } from "./ExecutionReportSeverityView";

export function ExecutionReportPreview({
  report,
  reportType,
}: {
  report: ExecutionReportOutput;
  reportType: ExecutionReportViewType;
}) {
  switch (reportType) {
    case "executive":
      return <ExecutionReportExecutiveView report={report} />;
    case "release":
      return <ExecutionReportReleaseView report={report} />;
    case "severity":
      return <ExecutionReportSeverityView report={report} />;
    case "failures":
      return <ExecutionReportFailuresView report={report} />;
    case "modules":
      return <ExecutionReportModulesView report={report} />;
    case "flows":
      return <ExecutionReportFlowsView report={report} />;
    case "flaky":
      return <ExecutionReportFlakyView report={report} />;
    case "rootCause":
      return <ExecutionReportRootCauseView report={report} />;
    case "actionPlan":
      return <ExecutionReportActionPlanView report={report} />;
    case "dashboard":
      return <ExecutionReportDashboardView report={report} />;
    case "execution":
    default:
      return <ExecutionReportExecutionView report={report} />;
  }
}
