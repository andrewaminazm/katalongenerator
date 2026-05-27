import express from "express";
import { loadProjectIndex } from "../services/projectIntelligence/index.js";
import { indexFingerprint, loadCachedRepair } from "../services/projectRepair/cache.js";
import {
  analyzeProjectRepair,
  executeProjectRepair,
  getRepairReport,
  previewProjectRepair,
  rollbackProjectRepair,
} from "../services/projectRepair/index.js";
import { readRepairedZipBuffer, buildRepairedProjectZip } from "../services/projectRepair/repairZipExport.js";

export function createProjectRepairRouter(): express.Router {
  const router = express.Router();

  router.post("/analyze", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const projectId = String(body.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId is required" });
        return;
      }
      const result = await analyzeProjectRepair({
        projectId,
        forceRefresh: body.forceRefresh === true,
        maxScripts: typeof body.maxScripts === "number" ? body.maxScripts : undefined,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post("/preview", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const projectId = String(body.projectId ?? "").trim();
      const repairId = String(body.repairId ?? "").trim();
      if (!projectId || !repairId) {
        res.status(400).json({ error: "projectId and repairId are required" });
        return;
      }
      const result = await previewProjectRepair({
        projectId,
        repairId,
        suggestionIds: Array.isArray(body.suggestionIds)
          ? body.suggestionIds.map(String)
          : undefined,
        mode: "preview",
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post("/repair", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const projectId = String(body.projectId ?? "").trim();
      const repairId = String(body.repairId ?? "").trim();
      if (!projectId || !repairId) {
        res.status(400).json({ error: "projectId and repairId are required" });
        return;
      }
      const result = await executeProjectRepair({
        projectId,
        repairId,
        suggestionIds: Array.isArray(body.suggestionIds)
          ? body.suggestionIds.map(String)
          : undefined,
        mode: (body.mode as "assisted" | "preview") ?? "assisted",
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post("/rollback", async (req, res, next) => {
    try {
      const rollbackId = String((req.body as Record<string, unknown>).rollbackId ?? "").trim();
      if (!rollbackId) {
        res.status(400).json({ error: "rollbackId is required" });
        return;
      }
      const result = await rollbackProjectRepair(rollbackId);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.get("/report/:repairId", async (req, res, next) => {
    try {
      const projectId = String(req.query.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId query param is required" });
        return;
      }
      const result = await getRepairReport(req.params.repairId, projectId);
      if (!result) {
        res.status(404).json({ error: "Repair report not found. Run POST /api/project-repair/analyze first." });
        return;
      }
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.get("/download/:repairId", async (req, res, next) => {
    try {
      const projectId = String(req.query.projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId query param is required" });
        return;
      }
      const index = await loadProjectIndex(projectId);
      if (!index) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const repairId = req.params.repairId;
      let buf = await readRepairedZipBuffer(repairId);
      if (!buf) {
        const cached = await loadCachedRepair(projectId, indexFingerprint(index));
        if (!cached || cached.repairId !== repairId) {
          res.status(404).json({ error: "Repaired zip not found. Run Apply safe repairs first." });
          return;
        }
        const diffs = cached.repairDiffs.filter((d) => d.changed);
        if (diffs.length === 0) {
          res.status(404).json({ error: "No repaired files to export." });
          return;
        }
        await buildRepairedProjectZip({
          projectId,
          repairId,
          diffs,
          projectName: cached.projectName,
        });
        buf = await readRepairedZipBuffer(repairId);
      }
      if (!buf) {
        res.status(404).json({ error: "Zip not found" });
        return;
      }
      const safeName = index.projectName.replace(/[^a-zA-Z0-9_-]/g, "_") || "project";
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="katalon-repaired-${safeName}-${repairId}.zip"`
      );
      res.send(buf);
    } catch (e) {
      next(e);
    }
  });

  router.get("/health/:projectId", async (req, res, next) => {
    try {
      const index = await loadProjectIndex(req.params.projectId);
      if (!index) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const cached = await loadCachedRepair(req.params.projectId, indexFingerprint(index));
      if (!cached) {
        res.status(404).json({ error: "No repair analysis cached. Run POST /api/project-repair/analyze first." });
        return;
      }
      res.json({
        projectId: cached.projectId,
        repairId: cached.repairId,
        healthScore: cached.healthScore,
        flakinessScore: cached.flakinessScore,
        frameworkHealth: cached.frameworkHealth,
        riskAreas: cached.riskAreas,
        suggestionCount: cached.repairSuggestions.length,
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
