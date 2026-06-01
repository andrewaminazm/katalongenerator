import { chromium } from "playwright";
import { getPlaywrightLaunchOptions } from "../playwrightLaunch.js";
import type { ExecutionReportOutput } from "./types.js";
import type { ExecutionReportPdfType } from "./executionReportPdfTypes.js";
import { EXECUTION_REPORT_PDF_META } from "./executionReportPdfTypes.js";
import { renderExecutionReportHtml } from "./executionReportHtml.js";

export function executionReportPdfFilename(
  projectName: string,
  buildId: string,
  reportType: ExecutionReportPdfType
): string {
  const safe = `${projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${buildId}`;
  const suffix = EXECUTION_REPORT_PDF_META[reportType].filenameSuffix;
  return `${safe}-${suffix}.pdf`;
}

export async function executionReportToPdfBuffer(
  report: ExecutionReportOutput,
  reportType?: ExecutionReportPdfType | string
): Promise<Buffer> {
  const html = renderExecutionReportHtml(report, reportType);
  const browser = await chromium.launch(getPlaywrightLaunchOptions());
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "14mm", left: "0", right: "0" },
      preferCSSPageSize: true,
    });
  } finally {
    await browser.close();
  }
}
