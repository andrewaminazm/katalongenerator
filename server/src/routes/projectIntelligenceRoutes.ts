import express from "express";
import multer from "multer";
import {
  buildGenerationPlan,
  deleteProject,
  ingestProjectFolder,
  ingestProjectArchive,
  listProjects,
  loadProjectIndex,
  reindexProject,
} from "../services/projectIntelligence/index.js";
import type { ProjectGenerationMode } from "../services/projectIntelligence/types.js";
import {
  matchKeywordsForStep,
  matchTestObjectsForStep,
  matchTestScriptsForStep,
} from "../services/projectIntelligence/semanticMatcher.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 120 * 1024 * 1024 },
});

function parseMode(raw: unknown): ProjectGenerationMode {
  const m = String(raw ?? "balanced");
  if (m === "strict_reuse" || m === "generate_everything") return m;
  return "balanced";
}

export function createProjectIntelligenceRouter(): express.Router {
  const router = express.Router();

  router.get("/", async (_req, res) => {
    try {
      const projects = await listProjects();
      res.json({ projects });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/upload", upload.single("archive"), async (req, res) => {
    try {
      const file = req.file;
      if (!file?.buffer) {
        res.status(400).json({ error: "Send multipart field 'archive' with a Katalon .zip or .rar" });
        return;
      }
      const lower = file.originalname.toLowerCase();
      if (!lower.endsWith(".zip") && !lower.endsWith(".rar")) {
        res.status(400).json({ error: "archive must be a .zip or .rar file" });
        return;
      }
      const projectName =
        typeof req.body?.projectName === "string" ? req.body.projectName : file.originalname;
      const index = await ingestProjectArchive(file.buffer, file.originalname, projectName);
      res.json({ ok: true, project: index });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/register-path", async (req, res) => {
    try {
      if (process.env.KATALON_PROJECT_LOCAL_PATH_ALLOWED !== "1") {
        res.status(403).json({
          error:
            "Local folder registration is disabled. Set KATALON_PROJECT_LOCAL_PATH_ALLOWED=1 on the server (self-hosted only).",
        });
        return;
      }
      const folderPath = String((req.body as { folderPath?: string }).folderPath ?? "").trim();
      if (!folderPath) {
        res.status(400).json({ error: "folderPath is required" });
        return;
      }
      const projectName =
        typeof (req.body as { projectName?: string }).projectName === "string"
          ? (req.body as { projectName?: string }).projectName
          : undefined;
      const index = await ingestProjectFolder(folderPath, projectName);
      res.json({ ok: true, project: index });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.get("/:projectId", async (req, res) => {
    const index = await loadProjectIndex(req.params.projectId);
    if (!index) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ project: index });
  });

  router.post("/:projectId/reindex", async (req, res) => {
    try {
      const index = await reindexProject(req.params.projectId);
      if (!index) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      res.json({ ok: true, project: index });
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.delete("/:projectId", async (req, res) => {
    const ok = await deleteProject(req.params.projectId);
    res.json({ ok });
  });

  router.post("/:projectId/match", async (req, res) => {
    try {
      const index = await loadProjectIndex(req.params.projectId);
      if (!index) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const body = req.body as { steps?: unknown; mode?: unknown };
      const steps = Array.isArray(body.steps)
        ? body.steps.map((s) => String(s).trim()).filter(Boolean)
        : [];
      const mode = parseMode(body.mode);
      const platform =
        (req.body as { platform?: string }).platform === "mobile" ? "mobile" : "web";
      const plan = buildGenerationPlan(steps, index, mode, platform);
      res.json({ plan });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.get("/:projectId/memory", async (req, res) => {
    try {
      const { loadProjectMemory, rebuildProjectMemoryFromIndex } = await import(
        "../services/aiMemory/index.js"
      );
      const refresh = req.query.refresh === "1" || req.query.refresh === "true";
      if (refresh) {
        const index = await loadProjectIndex(req.params.projectId);
        if (!index) {
          res.status(404).json({ error: "Project not found" });
          return;
        }
        const profile = await rebuildProjectMemoryFromIndex(index);
        res.json({ memory: profile });
        return;
      }
      const memory = await loadProjectMemory(req.params.projectId);
      if (!memory) {
        res.status(404).json({ error: "AI memory not built for this project — upload or reindex first" });
        return;
      }
      res.json({ memory });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/:projectId/v2/analyze", async (req, res) => {
    try {
      const { analyzeProjectV2 } = await import("../services/projectIntelligenceV2/index.js");
      const body = (req.body ?? {}) as Record<string, unknown>;
      const result = await analyzeProjectV2(req.params.projectId, {
        healScripts: body.healScripts !== false,
        healLocators: body.healLocators !== false,
        generateDocumentation: body.generateDocumentation !== false,
        maxScripts: typeof body.maxScripts === "number" ? body.maxScripts : undefined,
      });
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/:projectId/v2/fix-script", async (req, res) => {
    try {
      const scriptPath = String((req.body as { scriptPath?: string }).scriptPath ?? "").trim();
      if (!scriptPath) {
        res.status(400).json({ error: "scriptPath is required" });
        return;
      }
      const { fixProjectScript } = await import("../services/projectIntelligenceV2/index.js");
      const result = await fixProjectScript(req.params.projectId, scriptPath);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/:projectId/v2/documentation/pdf", async (req, res) => {
    try {
      const body = (req.body ?? {}) as { markdown?: string; title?: string; projectName?: string };
      const markdown = String(body.markdown ?? "").trim();
      if (!markdown) {
        res.status(400).json({ error: "markdown is required" });
        return;
      }
      const title =
        String(body.title ?? body.projectName ?? "Project documentation").trim() ||
        "Project documentation";
      const { markdownToPdfBuffer } = await import("../services/markdownPdf/markdownToPdf.js");
      const pdf = await markdownToPdfBuffer(markdown, title);
      const safeName = title.replace(/[^\w.-]+/g, "_").slice(0, 80) || "project-docs";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
      res.send(pdf);
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.post("/:projectId/v2/heal-locator", async (req, res) => {
    try {
      const orPath = String((req.body as { orPath?: string }).orPath ?? "").trim();
      if (!orPath) {
        res.status(400).json({ error: "orPath is required" });
        return;
      }
      const pageUrl =
        typeof (req.body as { pageUrl?: string }).pageUrl === "string"
          ? (req.body as { pageUrl?: string }).pageUrl
          : undefined;
      const { healProjectLocator } = await import("../services/projectIntelligenceV2/index.js");
      const result = await healProjectLocator(req.params.projectId, orPath, pageUrl);
      res.json(result);
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.get("/:projectId/v2/graph", async (req, res) => {
    try {
      const index = await loadProjectIndex(req.params.projectId);
      if (!index) {
        res.status(404).json({ error: "Project not found" });
        return;
      }
      const { buildProjectGraphV2 } = await import("../services/projectIntelligenceV2/index.js");
      res.json({ projectGraph: buildProjectGraphV2(index) });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  router.get("/:projectId/search", async (req, res) => {
    const index = await loadProjectIndex(req.params.projectId);
    if (!index) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    const q = String(req.query.q ?? "").trim();
    if (!q) {
      res.json({ testObjects: [], keywords: [], testScripts: [] });
      return;
    }
    const scripts = index.testScripts ?? index.testCases ?? [];
    res.json({
      testObjects: matchTestObjectsForStep(q, index.testObjects, 0.25),
      keywords: matchKeywordsForStep(q, index.keywords, 0.25),
      testScripts: matchTestScriptsForStep(q, scripts, 0.25),
    });
  });

  return router;
}
