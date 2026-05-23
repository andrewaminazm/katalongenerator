import express from "express";
import multer from "multer";
import {
  analyzeFailure,
  getFailurePatterns,
  listFailureHistory,
} from "../services/failureAnalysis/index.js";
import type { FailureAnalysisRequest } from "../services/failureAnalysis/types.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
});

function normalizeAnalyzeBody(body: Record<string, unknown>): FailureAnalysisRequest {
  return {
    logs: typeof body.logs === "string" ? body.logs : undefined,
    stacktrace: typeof body.stacktrace === "string" ? body.stacktrace : undefined,
    consoleLogs: typeof body.consoleLogs === "string" ? body.consoleLogs : undefined,
    screenshot: typeof body.screenshot === "string" ? body.screenshot : undefined,
    screenshotDescription:
      typeof body.screenshotDescription === "string" ? body.screenshotDescription : undefined,
    apiResponse: typeof body.apiResponse === "string" ? body.apiResponse : undefined,
    harLog: typeof body.harLog === "string" ? body.harLog : undefined,
    katalonReport: typeof body.katalonReport === "string" ? body.katalonReport : undefined,
    appiumLog: typeof body.appiumLog === "string" ? body.appiumLog : undefined,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    executionMetadata:
      body.executionMetadata && typeof body.executionMetadata === "object"
        ? (body.executionMetadata as FailureAnalysisRequest["executionMetadata"])
        : undefined,
    authorizationToken:
      typeof body.authorization_token === "string"
        ? body.authorization_token
        : typeof body.authorizationToken === "string"
          ? body.authorizationToken
          : undefined,
    model: typeof body.model === "string" ? body.model : undefined,
  };
}

export function createFailureRouter(): express.Router {
  const router = express.Router();

  router.post("/analyze", async (req, res) => {
    try {
      const body = normalizeAnalyzeBody(req.body as Record<string, unknown>);
      if (
        !body.logs?.trim() &&
        !body.katalonReport?.trim() &&
        !body.appiumLog?.trim() &&
        !body.stacktrace?.trim() &&
        !body.consoleLogs?.trim() &&
        !body.apiResponse?.trim()
      ) {
        res.status(400).json({
          error:
            "Provide Katalon execution logs (logs, katalonReport, or appiumLog). Stacktrace, screenshot, and HAR are optional.",
        });
        return;
      }
      const result = await analyzeFailure(body);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/screenshot", upload.single("screenshot"), async (req, res) => {
    try {
      const file = req.file;
      const body = normalizeAnalyzeBody((req.body ?? {}) as Record<string, unknown>);
      if (file?.buffer) {
        const mime = file.mimetype || "image/png";
        body.screenshot = `data:${mime};base64,${file.buffer.toString("base64")}`;
      }
      if (!body.screenshot && !body.logs?.trim() && !body.katalonReport?.trim()) {
        res.status(400).json({ error: "Upload screenshot and/or provide Katalon execution logs." });
        return;
      }
      if (body.screenshot && !body.screenshotDescription) {
        body.screenshotDescription =
          "Screenshot attached for visual failure analysis (popup, spinner, blank page, login redirect).";
      }
      const result = await analyzeFailure(body);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/logs", async (req, res) => {
    try {
      const body = normalizeAnalyzeBody(req.body as Record<string, unknown>);
      body.logs = body.logs ?? (typeof req.body?.text === "string" ? req.body.text : undefined);
      if (!body.logs?.trim()) {
        res.status(400).json({ error: "logs or text field is required." });
        return;
      }
      const result = await analyzeFailure(body);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.get("/history", async (_req, res) => {
    try {
      const limit = Number(_req.query.limit ?? 50);
      const history = await listFailureHistory(Math.min(200, limit));
      res.json({ history });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.get("/patterns", async (_req, res) => {
    try {
      const patterns = await getFailurePatterns();
      res.json({ patterns });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  return router;
}
