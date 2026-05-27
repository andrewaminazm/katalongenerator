import express from "express";
import { loadProjectIndex } from "../services/projectIntelligence/index.js";
import { indexFingerprint, loadCachedRefactor } from "../services/refactorAssistant/cache.js";
import { runRefactorAnalysis } from "../services/refactorAssistant/index.js";

export function createRefactorRouter(): express.Router {
  const router = express.Router();

  router.post("/analyze", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const projectId = String(body.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId is required" });
        return;
      }
      const result = await runRefactorAnalysis({
        projectId,
        forceRefresh: body.forceRefresh === true,
        maxScripts: typeof body.maxScripts === "number" ? body.maxScripts : undefined,
      });
      res.json(result);
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
      const cached = await loadCachedRefactor(req.params.projectId, indexFingerprint(index));
      if (!cached) {
        res.status(404).json({ error: "No refactor analysis cached. Run POST /api/refactor/analyze first." });
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
      const cached = await loadCachedRefactor(req.params.projectId, indexFingerprint(index));
      if (!cached) {
        res.status(404).json({ error: "No refactor analysis cached" });
        return;
      }
      res.json({
        projectId: cached.projectId,
        maintainabilityScore: cached.maintainabilityScore,
        frameworkHealthScore: cached.frameworkHealthScore,
        recommendations: cached.recommendations,
        duplicateFlows: cached.duplicateFlows,
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
