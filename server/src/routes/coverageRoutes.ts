import express from "express";
import { loadProjectIndex } from "../services/projectIntelligence/index.js";
import { loadCachedCoverage } from "../services/coverageAnalyzer/cache.js";
import { runCoverageAnalysis } from "../services/coverageAnalyzer/index.js";

export function createCoverageRouter(): express.Router {
  const router = express.Router();

  router.post("/analyze", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const projectId = String(body.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId is required" });
        return;
      }
      const result = await runCoverageAnalysis({
        projectId,
        swagger: typeof body.swagger === "string" ? body.swagger : undefined,
        postmanCollection:
          typeof body.postmanCollection === "string" ? body.postmanCollection : undefined,
        requirements: typeof body.requirements === "string" ? body.requirements : undefined,
        forceRefresh: body.forceRefresh === true,
        maxScripts: typeof body.maxScripts === "number" ? body.maxScripts : undefined,
      });
      const { coverageGraph, ...rest } = result;
      res.json({
        ...rest,
        coverageGraph: {
          nodeCount: coverageGraph.nodes.length,
          edgeCount: coverageGraph.edges.length,
          orphans: coverageGraph.orphans,
          duplicateFlowCount: coverageGraph.duplicates.flows.length,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/project/:projectId", async (req, res, next) => {
    try {
      const index = await loadProjectIndex(req.params.projectId);
      if (!index) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const { indexFingerprint } = await import("../services/coverageAnalyzer/cache.js");
      const cached = await loadCachedCoverage(req.params.projectId, indexFingerprint(index));
      if (!cached) {
        res.status(404).json({ error: "No coverage analysis cached. Run POST /api/coverage/analyze first." });
        return;
      }
      res.json(cached);
    } catch (e) {
      next(e);
    }
  });

  router.get("/recommendations/:projectId", async (req, res, next) => {
    try {
      const index = await loadProjectIndex(req.params.projectId);
      if (!index) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const { indexFingerprint } = await import("../services/coverageAnalyzer/cache.js");
      const cached = await loadCachedCoverage(req.params.projectId, indexFingerprint(index));
      if (!cached) {
        res.status(404).json({ error: "No coverage analysis cached" });
        return;
      }
      res.json({
        projectId: cached.projectId,
        recommendations: cached.recommendations,
        missingScenarios: cached.missingScenarios,
        overallCoverage: cached.overallCoverage,
        riskScore: cached.riskScore,
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
