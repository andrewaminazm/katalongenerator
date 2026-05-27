import { chromium } from "playwright";
import { getPlaywrightLaunchOptions } from "../playwrightLaunch.js";
import type { ExecutionReportOutput } from "./types.js";
import { renderExecutionReportHtml } from "./executionReportHtml.js";

export async function executionReportToPdfBuffer(
  report: ExecutionReportOutput
): Promise<Buffer> {
  const html = renderExecutionReportHtml(report);
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
