import express from "express";
import multer from "multer";
import { buildKatalonPrompt } from "../services/promptBuilder.js";
import {
  extractLocators,
  formatLocatorResultsAsLines,
  mergeLocatorTexts,
} from "../services/playwright.js";
import {
  cancelRecordingSession,
  getRecordingStatus,
  parsePlaywrightToSteps,
  recordUserFlow,
  startRecordingJob,
  takeRecordingResult,
} from "../services/playwrightRecorder.js";
import { generateWithOllama, streamOllama } from "../services/ollama.js";
import { parseTestStepsCsv, parsedStepsToStrings } from "../services/csvParser.js";
import {
  getJiraIssue,
  getMockJiraIssue,
  JiraApiError,
} from "../services/jira.js";
import { appendHistory, listHistory, clearHistory } from "../services/history.js";
import type { GenerateRequestBody, Platform } from "../types/index.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

function normalizeSteps(body: GenerateRequestBody): string[] {
  const raw = body.steps;
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s).trim()).filter(Boolean);
}

function validatePlatform(p: string): p is Platform {
  return p === "web" || p === "mobile";
}

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    const ollamaBase = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    res.json({
      ok: true,
      ollamaBase,
      defaultModel: DEFAULT_MODEL,
    });
  });

  router.post("/generate", async (req, res, next) => {
    try {
      const body = req.body as GenerateRequestBody;
      const platform = body.platform;
      if (!validatePlatform(platform)) {
        res.status(400).json({ error: "platform must be 'web' or 'mobile'" });
        return;
      }
      if (body.mode === "record" && platform !== "web") {
        res.status(400).json({ error: 'Recording mode is only supported for platform "web".' });
        return;
      }

      let steps = normalizeSteps(body);
      let userLocatorsText = body.locators ?? "";
      let recordedPlaywrightScript = body.recordedPlaywrightScript?.trim() ?? "";

      if (body.mode === "record" && body.url?.trim() && !recordedPlaywrightScript) {
        req.setTimeout(200000);
        res.setTimeout(200000);
        try {
          const rec = await recordUserFlow(body.url.trim());
          recordedPlaywrightScript = rec.playwrightScript;
          const recLines = rec.locators.map((l) => `${l.name} = ${l.selector}`).join("\n");
          userLocatorsText = mergeLocatorTexts(userLocatorsText, recLines);
          if (steps.length === 0) {
            steps = rec.steps;
          }
        } catch (err) {
          console.warn("[generate] record mode: live recording failed, using request body only", err);
        }
      }

      if (recordedPlaywrightScript && steps.length === 0) {
        const parsed = parsePlaywrightToSteps(recordedPlaywrightScript);
        steps = parsed.steps;
        if (!userLocatorsText.trim() && parsed.locators.length > 0) {
          userLocatorsText = parsed.locators.map((l) => `${l.name} = ${l.selector}`).join("\n");
        }
      }

      if (steps.length === 0) {
        res.status(400).json({
          error:
            "steps array must not be empty — add steps, run a successful record, or send recordedPlaywrightScript from the Record tab / record API.",
        });
        return;
      }

      const model = body.model?.trim() || DEFAULT_MODEL;
      let autoLocatorsText = "";
      if (body.autoDetectLocators === true && body.url?.trim()) {
        try {
          const extracted = await extractLocators(body.url.trim());
          autoLocatorsText = formatLocatorResultsAsLines(extracted);
        } catch (err) {
          console.warn("[generate] auto-detect locators skipped:", err);
        }
      }
      const prompt = buildKatalonPrompt({
        platform,
        steps,
        userLocatorsText,
        autoLocatorsText,
        testCaseName: body.testCaseName,
        recordedPlaywrightScript: recordedPlaywrightScript || undefined,
      });

      if (body.stream) {
        let headersSent = false;
        let full = "";
        try {
          for await (const chunk of streamOllama({ model, prompt })) {
            if (!headersSent) {
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.setHeader("Cache-Control", "no-cache");
              headersSent = true;
            }
            full += chunk;
            res.write(chunk);
          }
          if (headersSent) {
            res.end();
            await appendHistory({
              platform,
              model,
              testCaseName: body.testCaseName,
              stepsPreview: steps.join(" | ").slice(0, 200),
              code: full,
            });
          } else {
            res.status(502).json({ error: "Ollama returned an empty stream" });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!headersSent) {
            res.status(502).json({ error: msg });
          } else {
            res.end();
            next(e);
          }
        }
        return;
      }

      const result = await generateWithOllama({ model, prompt });
      const code = result.response.trim();

      await appendHistory({
        platform,
        model,
        testCaseName: body.testCaseName,
        stepsPreview: steps.join(" | ").slice(0, 200),
        code,
      });

      res.json({
        code,
        model: result.model,
        platform,
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/record/start", (req, res) => {
    try {
      const url = (req.body as { url?: string })?.url;
      if (!url || typeof url !== "string" || !url.trim()) {
        res.status(400).json({ error: "url is required" });
        return;
      }
      startRecordingJob(url.trim());
      res.json({ ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already in progress")) {
        res.status(409).json({ error: msg });
        return;
      }
      res.status(500).json({ error: msg });
    }
  });

  router.post("/record/cancel", async (_req, res, next) => {
    try {
      await cancelRecordingSession();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  router.get("/record/status", (_req, res) => {
    res.json(getRecordingStatus());
  });

  router.get("/record/result", (_req, res) => {
    try {
      const status = getRecordingStatus();
      if (status.active) {
        res.status(202).json({ pending: true });
        return;
      }
      const result = takeRecordingResult();
      res.json({
        steps: result.steps,
        locators: result.locators,
        playwrightScript: result.playwrightScript,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "NO_RESULT") {
        res.status(404).json({ error: "No recording result yet. Call POST /api/record/start first." });
        return;
      }
      res.status(500).json({ error: msg });
    }
  });

  router.post("/locators", async (req, res) => {
    try {
      const url = (req.body as { url?: string })?.url;
      if (!url || typeof url !== "string" || !url.trim()) {
        res.status(400).json({ error: "url is required" });
        return;
      }
      const locators = await extractLocators(url.trim());
      res.json({ locators });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/parse-csv", upload.single("file"), (req, res, next) => {
    try {
      const file = req.file;
      if (!file?.buffer) {
        res.status(400).json({ error: "CSV file is required (field name: file)" });
        return;
      }
      const text = file.buffer.toString("utf8");
      const parsed = parseTestStepsCsv(text);
      const steps = parsedStepsToStrings(parsed);
      res.json({ steps, rowCount: parsed.length });
    } catch (e) {
      next(e);
    }
  });

  router.post("/jira/issue", async (req, res, next) => {
    try {
      const body = req.body as {
        issueKey?: string;
        credentials?: {
          baseUrl?: string;
          email?: string;
          apiToken?: string;
        };
      };
      const issueKey = body.issueKey;
      if (!issueKey || typeof issueKey !== "string" || !issueKey.trim()) {
        res.status(400).json({ error: "issueKey is required" });
        return;
      }

      const c = body.credentials;
      const baseUrl = typeof c?.baseUrl === "string" ? c.baseUrl.trim() : "";
      const email = typeof c?.email === "string" ? c.email.trim() : "";
      const apiToken = typeof c?.apiToken === "string" ? c.apiToken.trim() : "";
      const filled = [baseUrl, email, apiToken].filter(Boolean).length;

      if (filled > 0 && filled < 3) {
        res.status(400).json({
          error:
            "Provide Jira base URL, email, and API token together, or leave all three empty for offline demo data.",
        });
        return;
      }

      if (filled === 3) {
        try {
          const result = await getJiraIssue(issueKey.trim(), {
            baseUrl,
            email,
            apiToken,
          });
          res.json({ ...result, mock: false });
        } catch (e) {
          if (e instanceof JiraApiError) {
            res.status(e.statusCode).json({ error: e.message });
            return;
          }
          throw e;
        }
        return;
      }

      res.json(getMockJiraIssue(issueKey.trim()));
    } catch (e) {
      next(e);
    }
  });

  router.get("/history", async (_req, res, next) => {
    try {
      const list = await listHistory(100);
      res.json({ entries: list });
    } catch (e) {
      next(e);
    }
  });

  router.delete("/history", async (_req, res, next) => {
    try {
      await clearHistory();
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
