import express from "express";
import type { FailureAnalysisRequest } from "../services/failureAnalysis/types.js";
import { analyzeFailure } from "../services/failureAnalysis/failureAnalyzer.js";
import {
  analyzeProjectReliability,
  buildProjectHeatmap,
  analyzeProjectFlakiness,
} from "../services/reliabilityIntelligence/index.js";

function normalizeBody(body: Record<string, unknown>): FailureAnalysisRequest {
  return {
    logs: typeof body.logs === "string" ? body.logs : undefined,
    stacktrace: typeof body.stacktrace === "string" ? body.stacktrace : undefined,
    consoleLogs: typeof body.consoleLogs === "string" ? body.consoleLogs : undefined,
    apiResponse: typeof body.apiResponse === "string" ? body.apiResponse : undefined,
    katalonReport: typeof body.katalonReport === "string" ? body.katalonReport : undefined,
    appiumLog: typeof body.appiumLog === "string" ? body.appiumLog : undefined,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    executionMetadata:
      body.executionMetadata && typeof body.executionMetadata === "object"
        ? (body.executionMetadata as FailureAnalysisRequest["executionMetadata"])
        : undefined,
  };
}

export function createReliabilityRouter(): express.Router {
  const router = express.Router();

  router.post("/analyze", async (req, res, next) => {
    try {
      const body = normalizeBody(req.body as Record<string, unknown>);
      if (
        !body.logs?.trim() &&
        !body.katalonReport?.trim() &&
        !body.stacktrace?.trim()
      ) {
        res.status(400).json({ error: "Provide logs, katalonReport, or stacktrace" });
        return;
      }
      const result = await analyzeFailure(body);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.get("/flaky/:projectId", async (req, res, next) => {
    try {
      const flaky = await analyzeProjectFlakiness(req.params.projectId);
      res.json({ projectId: req.params.projectId, modules: flaky });
    } catch (e) {
      next(e);
    }
  });

  router.get("/heatmap/:projectId", async (req, res, next) => {
    try {
      const heatmap = await buildProjectHeatmap(req.params.projectId);
      res.json({ projectId: req.params.projectId, heatmap });
    } catch (e) {
      next(e);
    }
  });

  router.get("/risk/:projectId", async (req, res, next) => {
    try {
      const report = await analyzeProjectReliability(req.params.projectId);
      res.json({
        projectId: report.projectId,
        reliabilityScore: report.reliabilityScore,
        stabilityScore: report.stabilityScore,
        flakyModules: report.flakyModules,
        recommendations: report.recommendations,
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/trends/:projectId", async (req, res, next) => {
    try {
      const report = await analyzeProjectReliability(req.params.projectId);
      res.json({ projectId: req.params.projectId, trends: report.trends });
    } catch (e) {
      next(e);
    }
  });

  router.get("/impact/:projectId", async (req, res, next) => {
    try {
      const corpus = String(req.query.corpus ?? req.query.keyword ?? "");
      const { predictRegressionImpact } = await import(
        "../services/reliabilityIntelligence/regressionPredictor.js"
      );
      const impact = await predictRegressionImpact(req.params.projectId, corpus);
      if (!impact) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json({ projectId: req.params.projectId, regressionImpact: impact });
    } catch (e) {
      next(e);
    }
  });

  router.get("/locator-health/:projectId", async (req, res, next) => {
    try {
      const report = await analyzeProjectReliability(req.params.projectId);
      res.json({
        projectId: req.params.projectId,
        locators: report.locatorHealthTop,
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/business-flows/:projectId", async (req, res, next) => {
    try {
      const report = await analyzeProjectReliability(req.params.projectId);
      res.json({
        projectId: req.params.projectId,
        flows: report.businessFlows,
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
