import express from "express";
import {
  generateExecutionReport,
  reportToMarkdown,
  type ExecutionReportInput,
} from "../services/executionReport/index.js";
import { markdownToPdfBuffer } from "../services/markdownPdf/markdownToPdf.js";

export function createExecutionReportRouter(): express.Router {
  const router = express.Router();

  router.post("/generate", (req, res) => {
    try {
      const body = req.body as ExecutionReportInput;
      const report = generateExecutionReport(body);
      res.json(report);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/pdf", async (req, res, next) => {
    try {
      const body = req.body as ExecutionReportInput;
      const report = generateExecutionReport(body);
      const markdown = reportToMarkdown(report);
      const pdf = await markdownToPdfBuffer(markdown, report.pdfTitle);
      const safeName = `${body.projectName.replace(/[^a-zA-Z0-9_-]/g, "_")}_${body.buildId}`;
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}-execution-report.pdf"`);
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
        testCaseName: "LoginTest",
        module: "Authentication",
        errorMessage: "Element not found: btn_Login",
        failureType: "UI",
        failureSeverity: "CRITICAL",
      },
      {
        testCaseName: "CheckoutPayment",
        module: "Payment",
        errorMessage: "API returned 500 on charge",
        failureType: "API",
        failureSeverity: "CRITICAL",
      },
      {
        testCaseName: "CartAddItem",
        module: "Checkout",
        errorMessage: "Timeout waiting for cart overlay",
        failureType: "TIMEOUT",
        failureSeverity: "HIGH",
      },
    ],
  };
}
