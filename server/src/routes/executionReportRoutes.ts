import express from "express";
import {
  generateExecutionReport,
  generateExecutiveQaIntelligence,
  type ExecutionReportInput,
} from "../services/executionReport/index.js";
import {
  executionReportPdfFilename,
  executionReportToPdfBuffer,
} from "../services/executionReport/executionReportPdf.js";
import { normalizeReportPdfType } from "../services/executionReport/executionReportPdfTypes.js";

export function createExecutionReportRouter(): express.Router {
  const router = express.Router();

  router.post("/generate", async (req, res, next) => {
    try {
      const body = req.body as ExecutionReportInput;
      const report = await buildReportWithExecutiveIntelligence(body, req.headers.authorization);
      res.json(report);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/pdf", async (req, res, next) => {
    try {
      const body = req.body as ExecutionReportInput;
      const report = await buildReportWithExecutiveIntelligence(body, req.headers.authorization);
      const reportType = normalizeReportPdfType(body.reportType);
      const pdf = await executionReportToPdfBuffer(report, reportType);
      const filename = executionReportPdfFilename(body.projectName, body.buildId, reportType);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(pdf);
    } catch (e) {
      next(e);
    }
  });

  router.get("/sample", (_req, res) => {
    res.json(sampleExecutionInput());
  });

  return router;
}

async function buildReportWithExecutiveIntelligence(
  body: ExecutionReportInput,
  authorization?: string
) {
  const report = generateExecutionReport(body);
  const reportType = normalizeReportPdfType(body.reportType);
  const needsExecutive =
    body.includeExecutiveIntelligence !== false ||
    reportType === "executive" ||
    reportType === "release";
  if (!needsExecutive) return report;

  const preferAi =
    body.preferAiNarrative === true || reportType === "executive";

  const intel = await generateExecutiveQaIntelligence(body, report, {
    authorizationToken: typeof authorization === "string" ? authorization : undefined,
    preferAi,
  });
  report.executiveIntelligence = {
    markdown: intel.markdown,
    directorStatus: intel.directorStatus,
    deploymentRecommendation: intel.deploymentRecommendation,
    generatedBy: intel.generatedBy,
    model: intel.model,
  };
  return report;
}

export function sampleExecutionInput(): ExecutionReportInput {
  return {
    projectName: "Katalon Automation Suite",
    buildId: "BUILD-10291",
    executionDate: new Date().toISOString().slice(0, 10),
    environment: "QA / Staging",
    pipelineName: "nightly-regression",
    branch: "main",
    testExecution: {
      totalTestCases: 120,
      passed: 95,
      failed: 25,
      skipped: 0,
      duration: "18m 32s",
    },
    failedTests: [
      {
        bugName: "Login fails when username has spaces",
        jiraId: "AUTH-1234",
        module: "Authentication",
        errorMessage: "Element not found: btn_Login",
        failureType: "UI",
        failureSeverity: "CRITICAL",
      },
      {
        bugName: "Checkout payment returns 500",
        jiraId: "PAY-900",
        module: "Payment",
        errorMessage: "API returned 500 on charge",
        failureType: "API",
        failureSeverity: "CRITICAL",
      },
      {
        bugName: "Add to cart times out on overlay",
        jiraId: "CHK-210",
        module: "Checkout",
        errorMessage: "Timeout waiting for cart overlay",
        failureType: "TIMEOUT",
        failureSeverity: "HIGH",
      },
    ],
  };
}
