import express from "express";
import {
  buildMemoryInsights,
  buildKnowledgeGraphExport,
  indexWorkspaceMemory,
  learnFromInput,
  searchWorkspaceMemory,
} from "../services/workspaceMemory/index.js";
import { loadProjectIndex } from "../services/projectIntelligence/index.js";
import { assertProjectAccess, redactSecrets } from "../services/workspaceMemory/memorySecurity.js";
import { getOrBuildMemoryIndex } from "../services/workspaceMemory/memoryEngine.js";

export function createWorkspaceMemoryRouter(): express.Router {
  const router = express.Router();

  router.post("/index", async (req, res, next) => {
    try {
      const projectId = String((req.body as { projectId?: string }).projectId ?? "").trim();
      if (!projectId) {
        res.status(400).json({ error: "projectId is required" });
        return;
      }
      assertProjectAccess(projectId);
      const index = await indexWorkspaceMemory(projectId);
      res.json({
        projectId: index.projectId,
        projectName: index.projectName,
        chunkCount: index.chunkCount,
        indexedAt: index.indexedAt,
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/search", async (req, res, next) => {
    try {
      const body = req.body as { projectId?: string; query?: string; limit?: number };
      const projectId = String(body.projectId ?? "").trim();
      const query = String(body.query ?? "").trim();
      if (!projectId || !query) {
        res.status(400).json({ error: "projectId and query are required" });
        return;
      }
      assertProjectAccess(projectId);
      const result = await searchWorkspaceMemory(projectId, query, body.limit ?? 10);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post("/learn", async (req, res, next) => {
    try {
      const body = req.body as {
        projectId?: string;
        layer?: string;
        title?: string;
        content?: string;
        source?: string;
      };
      const projectId = String(body.projectId ?? "").trim();
      const title = String(body.title ?? "").trim();
      const content = redactSecrets(String(body.content ?? "").trim());
      if (!projectId || !title || !content) {
        res.status(400).json({ error: "projectId, title, and content are required" });
        return;
      }
      assertProjectAccess(projectId);
      const index = await learnFromInput({
        projectId,
        layer: (body.layer as "pattern") ?? "pattern",
        title,
        content,
        source: body.source as "user_correction" | undefined,
      });
      res.json({ projectId, chunkCount: index.chunkCount, saved: true });
    } catch (e) {
      next(e);
    }
  });

  router.get("/graph/:projectId", async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      assertProjectAccess(projectId);
      const projectIndex = await loadProjectIndex(projectId);
      if (!projectIndex) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      await getOrBuildMemoryIndex(projectId);
      res.json(buildKnowledgeGraphExport(projectIndex));
    } catch (e) {
      next(e);
    }
  });

  router.get("/flows/:projectId", async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      assertProjectAccess(projectId);
      const index = await getOrBuildMemoryIndex(projectId);
      if (!index) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const flows = index.chunks
        .filter((c) => c.layer === "flow")
        .map((c) => ({ id: c.id, title: c.title, content: c.content, confidence: c.confidence }));
      res.json({ projectId, flows });
    } catch (e) {
      next(e);
    }
  });

  router.get("/insights/:projectId", async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      assertProjectAccess(projectId);
      const insights = await buildMemoryInsights(projectId);
      res.json(insights);
    } catch (e) {
      next(e);
    }
  });

  router.get("/risk/:projectId", async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      assertProjectAccess(projectId);
      const index = await getOrBuildMemoryIndex(projectId);
      if (!index) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const risks = index.chunks
        .filter((c) => c.layer === "risk" || c.layer === "locator")
        .map((c) => ({
          id: c.id,
          layer: c.layer,
          title: c.title,
          content: c.content.slice(0, 300),
          confidence: c.confidence,
        }));
      res.json({ projectId, risks });
    } catch (e) {
      next(e);
    }
  });

  router.get("/recommendations/:projectId", async (req, res, next) => {
    try {
      const projectId = req.params.projectId;
      assertProjectAccess(projectId);
      const insights = await buildMemoryInsights(projectId);
      res.json({ projectId, recommendations: insights.recommendations });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
