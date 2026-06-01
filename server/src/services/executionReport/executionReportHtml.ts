import type { ExecutionReportOutput } from "./types.js";
import type { ExecutionReportPdfType } from "./executionReportPdfTypes.js";
import { normalizeReportPdfType } from "./executionReportPdfTypes.js";
import { renderReportBody } from "./executionReportHtmlBody.js";
import {
  renderCover,
  renderPageFooter,
  renderPdfStyles,
} from "./executionReportHtmlShared.js";

export function renderExecutionReportHtml(
  report: ExecutionReportOutput,
  reportType?: ExecutionReportPdfType | string
): string {
  const type = normalizeReportPdfType(
    typeof reportType === "string" ? reportType : reportType
  );

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${report.pdfTitle}</title>
  <style>${renderPdfStyles()}</style>
</head>
<body>
  ${renderCover(report, type)}
  ${renderReportBody(report, type)}
  ${renderPageFooter(report, type)}
</body>
</html>`;
}
