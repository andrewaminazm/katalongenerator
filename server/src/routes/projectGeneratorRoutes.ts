import express from "express";
import fs from "node:fs/promises";
import {
  analyzeProjectGeneration,
  generateEnterpriseProject,
  loadProjectGeneratorPreview,
  PROJECT_TEMPLATES,
  runMigration,
} from "../services/projectGenerator/index.js";
import type {
  MigrationInput,
  ProjectGeneratorInput,
} from "../services/projectGenerator/types.js";
import { generationZipPath } from "../services/projectGenerator/cache.js";

function parseInput(body: Record<string, unknown>): ProjectGeneratorInput {
  return {
    projectName: String(body.projectName ?? ""),
    description: String(body.description ?? ""),
    frameworkKind: (body.frameworkKind as ProjectGeneratorInput["frameworkKind"]) ?? "hybrid",
    architecturePattern:
      (body.architecturePattern as ProjectGeneratorInput["architecturePattern"]) ?? "layered",
    domain: (body.domain as ProjectGeneratorInput["domain"]) ?? "generic",
    projectSize: (body.projectSize as ProjectGeneratorInput["projectSize"]) ?? "standard",
    reuseMode:
      (body.reuseMode as ProjectGeneratorInput["reuseMode"]) ?? "balanced",
    sourceProjectId: body.sourceProjectId ? String(body.sourceProjectId) : undefined,
    inputSources: Array.isArray(body.inputSources)
      ? (body.inputSources as ProjectGeneratorInput["inputSources"])
      : ["description"],
    businessFlows: Array.isArray(body.businessFlows)
      ? body.businessFlows.map(String)
      : [],
    modules: Array.isArray(body.modules) ? body.modules.map(String) : [],
    includeReporting: body.includeReporting !== false,
    includeBdd: body.includeBdd === true,
    includePerformance: body.includePerformance === true,
    includeMobile: body.includeMobile === true,
    swaggerText: body.swaggerText ? String(body.swaggerText) : undefined,
    postmanText: body.postmanText ? String(body.postmanText) : undefined,
    jiraEpic: body.jiraEpic ? String(body.jiraEpic) : undefined,
  };
}

export function createProjectGeneratorRouter(): express.Router {
  const router = express.Router();

  router.get("/templates", (_req, res) => {
    res.json({ templates: PROJECT_TEMPLATES });
  });

  router.post("/analyze", async (req, res, next) => {
    try {
      const input = parseInput(req.body as Record<string, unknown>);
      if (!input.projectName.trim()) {
        res.status(400).json({ error: "projectName is required" });
        return;
      }
      const result = await analyzeProjectGeneration({ input });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post("/generate", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const input = parseInput(body);
      if (!input.projectName.trim()) {
        res.status(400).json({ error: "projectName is required" });
        return;
      }
      const result = await generateEnterpriseProject({
        input,
        forceRefresh: body.forceRefresh === true,
      });
      res.json({
        projectId: result.generationId,
        frameworkType: result.frameworkType,
        generatedModules: result.generatedModules,
        pages: result.pages,
        keywords: result.keywords,
        apis: result.apis,
        suites: result.suites,
        documentation: result.documentation,
        healthScore: result.healthScore,
        frameworkHealth: result.frameworkHealth,
        dependencyGraph: result.dependencyGraph,
        warnings: result.warnings,
        downloadableZip: `/api/project-generator/download/${result.generationId}`,
        generationId: result.generationId,
        projectName: result.projectName,
        architecturePattern: result.architecturePattern,
        generatedAt: result.generatedAt,
        fromCache: result.fromCache,
        structurePreview: result.files.slice(0, 120).map((f) => f.path),
        fileCount: result.files.length,
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/migrate", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const payload = String(body.payload ?? "");
      if (!payload.trim()) {
        res.status(400).json({ error: "payload is required" });
        return;
      }
      const migration: MigrationInput = {
        sourceType: (body.sourceType as MigrationInput["sourceType"]) ?? "postman",
        payload,
        projectName: String(body.projectName ?? "MigratedProject"),
        targetPattern: body.targetPattern as MigrationInput["targetPattern"],
      };
      const result = await runMigration(migration);
      res.json({
        ...result,
        downloadableZip: `/api/project-generator/download/${result.generationId}`,
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/preview/:id", async (req, res, next) => {
    try {
      const preview = await loadProjectGeneratorPreview(req.params.id);
      if (!preview) {
        res.status(404).json({ error: "Generation not found. Run POST /api/project-generator/generate first." });
        return;
      }
      res.json(preview);
    } catch (e) {
      next(e);
    }
  });

  router.get("/download/:id", async (req, res, next) => {
    try {
      const zipPath = generationZipPath(req.params.id);
      const buf = await fs.readFile(zipPath);
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="katalon-project-${req.params.id}.zip"`
      );
      res.send(buf);
    } catch {
      res.status(404).json({ error: "Zip not found" });
    }
  });

  return router;
}
