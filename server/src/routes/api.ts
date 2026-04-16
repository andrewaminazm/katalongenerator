import express from "express";
import multer from "multer";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildKatalonPrompt, type PromptExtraOptions } from "../services/promptBuilder.js";
import {
  extractLocators,
  filterLocatorsBySteps,
  formatLocatorResultsAsLines,
  mergeLocatorTexts,
} from "../services/playwright.js";
import { extractPlaywrightLocatorLines } from "../services/playwrightLocatorLines.js";
import {
  cancelRecordingSession,
  getRecordingStatus,
  recordUserFlow,
  startRecordingJob,
  takeRecordingResult,
} from "../services/playwrightRecorder.js";
import { runPlaywrightRecordingPipeline } from "../services/recordingIntelligence/universalRecordingPipeline.js";
import { generateWithOllama, streamOllama } from "../services/ollama.js";
import { generateWithGemini, streamGemini } from "../services/gemini.js";
import {
  parseTestStepsCsv,
  parsedStepsToStrings,
  parseTestCaseCsvRows,
} from "../services/csvParser.js";
import {
  getJiraIssue,
  getMockJiraIssue,
  JiraApiError,
} from "../services/jira.js";
import { appendHistory, listHistory, clearHistory } from "../services/history.js";
import { normalizeKatalonProjectXml } from "../services/projectContext.js";
import { mergeKatalonImportedAssets, contextHasAnyAssets } from "../services/katalonContextMerge.js";
import {
  extractObjectRepositoryPathsFromZip,
  extractPathsFromUploadedOrFiles,
  extractPathsFromUploadedTestCaseFiles,
  extractPathsFromUploadedTestSuiteFiles,
  extractTestCasePathsFromZip,
  extractTestSuitePathsFromZip,
} from "../services/katalonZipImport.js";
import { matchStepsToOr, formatOrSuggestionsForPrompt } from "../services/orMatcher.js";
import { extractOrPathsFromLocatorLines } from "../services/locatorPaths.js";
import { lintGroovy, normalizeKatalonWebGroovy, simplifyGroovyFormatting } from "../services/groovyLint.js";
import { compileKatalonScript } from "../services/katalonCompiler/index.js";
import { autoFixGroovy } from "../services/katalonCompiler/autoFixEngine.js";
import { validateKatalonGroovy } from "../services/katalonCompiler/validationLayer.js";
import { convertLocatorLines } from "../services/katalonCompiler/universalLocatorConverter.js";
import { sanitizeKatalonLocatorLines, stripPlaywrightLeakageFromGroovy } from "../services/locatorPipeline/autoFixLocatorEngine.js";
import { runUniversalTestStepIntelligence } from "../services/testDsl/universalTestStepIntelligence.js";
import {
  compareRecordingToDslSteps,
  validateStrictRecordingFidelity,
} from "../services/recordingIntelligence/recordingFidelityValidator.js";
import {
  validateDslSelectorsTraceableInLocatorText,
  type LocatorTraceabilityReport,
} from "../services/recordingIntelligence/generationFidelityGate.js";
import type { TestDslStep } from "../services/testDsl/universalStepNormalizer.js";
import { optimizeGroovyExecution } from "../services/executionOptimizer.js";
import { enforceExecutionDependencies } from "../services/executionDependencyEngine.js";
import { optimizeWithExecutionState } from "../services/executionStateOptimizer.js";
import {
  listHealingMemory,
  normalizeFailureReport,
  runLocatorHealing,
} from "../services/healing/index.js";
import type {
  GenerateRequestBody,
  LlmProvider,
  Platform,
  PlaywrightPageLocale,
} from "../types/index.js";

function parsePageLocale(v: unknown): PlaywrightPageLocale {
  if (v === "en" || v === "ar" || v === "auto") return v;
  return "auto";
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const uploadKatalon = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 6000 },
});

const DEFAULT_OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

function resolveLlm(body: GenerateRequestBody): LlmProvider {
  const v = body.llm;
  if (v === "gemini" || v === "ollama") return v;
  return "ollama";
}

function normalizeSteps(body: GenerateRequestBody): string[] {
  const raw = body.steps;
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s).trim()).filter(Boolean);
}

/** Record mode defaults to lossless replay unless the client explicitly sets false. */
function resolvePreserveRecordingFidelity(body: GenerateRequestBody): boolean {
  if (body.preserveRecordingFidelity === true) return true;
  if (body.preserveRecordingFidelity === false) return false;
  return body.mode === "record";
}

function validatePlatform(p: string): p is Platform {
  return p === "web" || p === "mobile";
}

function normalizeImportedPaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map((x) => String(x).trim()).filter(Boolean))];
}

function healingPayload(body: GenerateRequestBody): { healing: Record<string, unknown> } | Record<string, never> {
  if (body.includeHealingMetadata === false) {
    return {};
  }
  return {
    healing: {
      endpoint: "POST /api/heal/locator",
      memory: "GET /api/heal/memory",
      description:
        "Rule-based locator recovery (Playwright) first; Ollama AI repair only if retries fail. POST failure JSON to heal/locator.",
    },
  };
}

function normalizeUserPath(p: string): string {
  return p.trim().replace(/^"|"$/g, "");
}

function isDirectory(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function toPosixRel(p: string): string {
  return p.replace(/\\/g, "/");
}

function sanitizeTestCaseName(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  if (s.includes("..")) return "";
  if (/[\\/]/.test(s)) return "";
  // Windows reserved characters + control chars
  const cleaned = s.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_").trim();
  return cleaned.replace(/\s+/g, " ");
}

function dedupeImportsGroovy(code: string): string {
  const lines = code.replace(/^\uFEFF/, "").split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\s*import\s+.+$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const key = line.trim().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  const text = out.join("\n").trimEnd();
  return text.length ? `${text}\n` : "";
}

function normalizeGroovyNewlines(code: string): string {
  // Strip UTF-8 BOM if present (Katalon Groovy editor can behave oddly with BOM).
  let c = code.replace(/^\uFEFF/, "");
  // Some clients may send Groovy with literal "\n" sequences instead of actual newlines.
  // If we detect that, unescape it so downstream cleanup (dedupe, lint) works.
  if (!c.includes("\n") && c.includes("\\n")) {
    c = c.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
  }
  return c;
}

function stripBomEverywhere(code: string): string {
  return code.replace(/\uFEFF/g, "");
}

function stripLeadingControlCharsPerLine(code: string): string {
  // Remove non-printable leading chars that can show up as "?" in some editors.
  return code
    .split(/\r?\n/)
    .map((line) => line.replace(/^[\u0000-\u001F\u007F\uFEFF]+/, ""))
    .join("\n");
}

function sanitizeImportLines(code: string): string {
  // Some clients embed invisible chars before `import` (looks like `?import ...` in Studio).
  return code
    .split(/\r?\n/)
    .map((line) => {
      const t = line.replace(/^[\u0000-\u001F\u007F\uFEFF]+/, "");
      if (/^\s*import\b/i.test(t)) return t.replace(/^[\u0000-\u001F\u007F\uFEFF]*import\b/i, "import");
      const idx = t.search(/\bimport\b/i);
      if (idx > 0) {
        // Strip junk prefix before the first `import` token (common when invisible chars break trimming).
        return t.slice(idx).replace(/^import\b/i, "import");
      }
      // Literal junk prefixes like `u0001import ...` — keep only from `import` onward.
      const m2 = t.match(/^(.*?)(import\b.*)$/i);
      if (m2?.[2] && !/^\s*\/\//.test(t)) return m2[2];
      return t;
    })
    .join("\n");
}

function readTcName(tcXml: string): string | null {
  const m = tcXml.match(/<name>\s*([^<]*?)\s*<\/name>/i);
  return m ? m[1].trim() : null;
}

function dedupeConsecutiveActionsGroovy(code: string): string {
  // Remove repeated consecutive lines like:
  // WebUI.waitForPageLoad(10)
  // WebUI.waitForPageLoad(10)
  //
  // Keep ordering; only collapse exact consecutive duplicates (ignoring trailing whitespace).
  const lines = code.split(/\r?\n/);
  const out: string[] = [];
  let prevKey: string | null = null;
  for (const line of lines) {
    const key = line.trimEnd();
    if (key.length === 0) {
      out.push(line);
      prevKey = null;
      continue;
    }
    if (prevKey !== null && key === prevKey) {
      continue;
    }
    out.push(line);
    prevKey = key;
  }
  return out.join("\n");
}

function buildTcXml(name: string, guid: string): string {
  // Katalon requires a .tc metadata file (sibling of the folder) to bind Script.groovy.
  // Template must include <variables/> for Studio to reliably load the test case.
  return `<?xml version="1.0" encoding="UTF-8"?>\n<TestCaseEntity>\n   <description></description>\n   <name>${name}</name>\n   <tag></tag>\n   <comment></comment>\n   <recordOption>OTHER</recordOption>\n   <testCaseGuid>${guid}</testCaseGuid>\n   <variables/>\n</TestCaseEntity>\n`;
}

function rmDirIfExists(p: string): void {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  } catch {
    // ignore
  }
}

function rmFileIfExists(p: string): void {
  try {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) {
      fs.unlinkSync(p);
    }
  } catch {
    // ignore
  }
}

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    const ollamaBase = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
    const geminiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim());
    res.json({
      ok: true,
      ollamaBase,
      defaultModel: DEFAULT_OLLAMA_MODEL,
      geminiConfigured,
      defaultGeminiModel: DEFAULT_GEMINI_MODEL,
    });
  });

  router.post("/export/katalon", (req, res) => {
    try {
      const body = req.body as {
        projectPath?: unknown;
        testCaseName?: unknown;
        script?: unknown;
        createTcFile?: unknown;
      };

      const projectPath = normalizeUserPath(String(body.projectPath ?? ""));
      const requestedName = String(body.testCaseName ?? "");
      const scriptRaw = String(body.script ?? "");
      const createTcFile = body.createTcFile !== false;

      if (!projectPath) {
        res.status(400).json({ error: "projectPath is required" });
        return;
      }
      if (!isDirectory(projectPath)) {
        res.status(400).json({ error: "projectPath must be an existing directory" });
        return;
      }
      const testCasesRoot = path.join(projectPath, "Test Cases");
      if (!isDirectory(testCasesRoot)) {
        res.status(400).json({ error: 'Invalid Katalon project: missing "Test Cases" folder' });
        return;
      }

      const baseName = sanitizeTestCaseName(requestedName);
      if (!baseName) {
        res.status(400).json({
          error:
            "testCaseName is required and must not contain path separators (/) or (\\) or '..'",
        });
        return;
      }
      if (!scriptRaw.trim()) {
        res.status(400).json({ error: "script is required" });
        return;
      }
      if (!createTcFile) {
        res.status(400).json({ error: "createTcFile must be true — Katalon requires a sibling .tc file next to the test case folder" });
        return;
      }

      // Ensure "clean script" rules.
      let script = normalizeGroovyNewlines(scriptRaw);
      script = dedupeImportsGroovy(script);
      script = stripPlaywrightLeakageFromGroovy(script);
      // Web normalization also fixes common import/openBrowser issues and removes invalid Selenium imports.
      script = normalizeKatalonWebGroovy(script);
      script = autoFixGroovy(script, "web");
      // Normalization may add/reshape imports; dedupe again and strip any stray BOM chars.
      script = dedupeImportsGroovy(script);
      script = sanitizeImportLines(script);
      script = dedupeImportsGroovy(script);
      script = sanitizeImportLines(script);
      script = stripLeadingControlCharsPerLine(stripBomEverywhere(script));
      script = dedupeConsecutiveActionsGroovy(script);

      if (!script.trim()) {
        res.status(422).json({ error: "Export failed: script became empty after sanitization" });
        return;
      }

      const v = validateKatalonGroovy(script);
      if (v.errors.length > 0) {
        res.status(422).json({ error: `Groovy validation failed:\n- ${v.errors.join("\n- ")}` });
        return;
      }
      const lint = lintGroovy(script, new Set(), { platform: "web" });
      const lintErrors = lint.filter((i) => i.severity === "error");
      if (lintErrors.length > 0) {
        res.status(422).json({
          error: `Groovy lint failed:\n- ${lintErrors.map((e) => `${e.rule}: ${e.message}`).join("\n- ")}`,
        });
        return;
      }

      const finalName = baseName;

      // Katalon layout (required):
      // Test Cases/<Name>.tc
      // Scripts/<Name>/Script.groovy
      const scriptsRoot = path.join(projectPath, "Scripts");
      if (!isDirectory(scriptsRoot)) {
        res.status(400).json({ error: 'Invalid Katalon project: missing "Scripts" folder' });
        return;
      }

      const scriptDir = path.join(scriptsRoot, finalName);
      const tcSiblingPath = path.join(testCasesRoot, `${finalName}.tc`);

      // Clean slate: remove prior script folder + .tc (and legacy wrong placements).
      rmDirIfExists(scriptDir);
      rmFileIfExists(tcSiblingPath);
      // Legacy wrong: `Test Cases/<Name>/Script.groovy` (folder-based TC layout)
      rmDirIfExists(path.join(testCasesRoot, finalName));
      // Legacy wrong: `.tc` inside a folder
      rmFileIfExists(path.join(testCasesRoot, finalName, `${finalName}.tc`));

      fs.mkdirSync(scriptDir, { recursive: true });

      const scriptPath = path.join(scriptDir, "Script.groovy");
      fs.writeFileSync(scriptPath, script, "utf8");

      const guid = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
      const tcXml = buildTcXml(finalName, guid);
      fs.writeFileSync(tcSiblingPath, tcXml, "utf8");

      if (!fs.existsSync(scriptPath) || !fs.existsSync(tcSiblingPath)) {
        res.status(500).json({ error: "Export failed: Script.groovy or .tc was not written to disk" });
        return;
      }
      const scriptBytes = fs.statSync(scriptPath).size;
      const tcBytes = fs.statSync(tcSiblingPath).size;
      if (scriptBytes <= 0 || tcBytes <= 0) {
        res.status(500).json({ error: "Export failed: Script.groovy or .tc is empty on disk" });
        return;
      }
      const diskScript = fs.readFileSync(scriptPath, "utf8");
      if (!diskScript.trim()) {
        res.status(500).json({ error: "Export failed: Script.groovy contains no non-whitespace content" });
        return;
      }
      const diskTc = fs.readFileSync(tcSiblingPath, "utf8");
      const tcName = readTcName(diskTc);
      if (!tcName || tcName !== finalName) {
        res.status(500).json({ error: `Export failed: .tc <name> mismatch (expected '${finalName}', got '${tcName ?? ""}')` });
        return;
      }

      res.json({
        success: true,
        message: "Test case created successfully",
        testCaseName: finalName,
        path: toPosixRel(path.join("Test Cases", `${finalName}.tc`)),
        scriptPath,
        tcPath: tcSiblingPath,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/heal/locator", async (req, res, next) => {
    try {
      const url = String(req.body?.url ?? "").trim();
      const failure = normalizeFailureReport(req.body);
      if (!url || !failure) {
        res.status(400).json({
          error:
            "Requires JSON body: { url, stepId, action, failedLocator: { type, value }, errorType?, domSnapshot?, maxRetries?, skipAi? }",
        });
        return;
      }
      const maxRetries =
        typeof req.body?.maxRetries === "number" && req.body.maxRetries > 0
          ? req.body.maxRetries
          : undefined;
      const result = await runLocatorHealing({
        url,
        failure,
        maxRetries,
        skipAi: Boolean(req.body?.skipAi),
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.get("/heal/memory", async (_req, res, next) => {
    try {
      const entries = await listHealingMemory(100);
      res.json({ entries });
    } catch (e) {
      next(e);
    }
  });

  router.post("/generate", async (req, res, next) => {
    try {
      const body = req.body as GenerateRequestBody;
      const platform = body.platform;
      const preserveRecordingFidelity = resolvePreserveRecordingFidelity(body);
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
      let skipSecondStepNormalizer = false;
      let playwrightParseActionCount: number | undefined;
      /** Playwright → DSL only — used for flexible selector binding gate + compile map. */
      let pipelineDsl: TestDslStep[] | undefined;
      let selectorTraceReport: LocatorTraceabilityReport | undefined;

      let katalonProjectContext;
      try {
        katalonProjectContext = normalizeKatalonProjectXml(body.katalonProjectXml);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid katalonProjectXml";
        res.status(400).json({ error: msg });
        return;
      }
      const importedPaths = normalizeImportedPaths(body.importedObjectRepositoryPaths);
      const importedTc = normalizeImportedPaths(body.importedTestCasePaths);
      const importedTs = normalizeImportedPaths(body.importedTestSuitePaths);
      katalonProjectContext = mergeKatalonImportedAssets(katalonProjectContext, {
        objectRepository: importedPaths,
        testCases: importedTc,
        testSuites: importedTs,
      });
      if (!contextHasAnyAssets(katalonProjectContext)) {
        katalonProjectContext = undefined;
      }

      const pathsFromLocators = extractOrPathsFromLocatorLines(userLocatorsText);
      const mergedOrList = [
        ...new Set([
          ...(katalonProjectContext?.objectRepository ?? []),
          ...importedPaths,
          ...pathsFromLocators,
        ]),
      ];
      const includeSug = body.includeStepOrSuggestions !== false && mergedOrList.length > 0;
      const orSuggestionsText = includeSug
        ? formatOrSuggestionsForPrompt(matchStepsToOr(steps, mergedOrList))
        : undefined;

      const promptExtras: PromptExtraOptions = {
        testTemplate: body.testTemplate,
        executionProfile: body.executionProfile,
        globalVariablesNote: body.globalVariablesNote,
        commentLanguage: body.commentLanguage,
        stylePass: body.stylePass,
        orSuggestionsText,
      };

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
        const { pw, normalized } = runPlaywrightRecordingPipeline(recordedPlaywrightScript, {
          platform,
          preserveRecordingFidelity,
        });
        if (pw.dsl.length === 0 && pw.errors.length > 0) {
          res.status(422).json({
            error: "Playwright action dropped during parsing",
            playwrightParseErrors: pw.errors,
          });
          return;
        }
        if (!normalized || normalized.errors.length > 0) {
          res.status(422).json({
            error: "Steps could not be safely normalized after Playwright parse",
            stepNormalizationErrors: normalized?.errors ?? [],
            stepNormalizationWarnings: normalized?.warnings ?? [],
            dsl: normalized?.dsl,
          });
          return;
        }
        playwrightParseActionCount = pw.dsl.length;
        if (preserveRecordingFidelity) {
          const strict = validateStrictRecordingFidelity(
            playwrightParseActionCount,
            normalized.canonicalSteps.length
          );
          if (!strict.ok) {
            res.status(422).json({
              error: strict.message ?? "Recording fidelity validation failed",
              recordingFidelity: {
                ...compareRecordingToDslSteps(playwrightParseActionCount, normalized.canonicalSteps.length),
                preserveRecordingFidelity,
                strictMode: true,
              },
            });
            return;
          }
        }
        steps = normalized.canonicalSteps;
        pipelineDsl = normalized.dsl;
        skipSecondStepNormalizer = true;
        if (!userLocatorsText.trim() && pw.locators.length > 0) {
          userLocatorsText = pw.locators.map((l) => `${l.name} = ${l.selector}`).join("\n");
        }
      }

      if (steps.length === 0) {
        res.status(400).json({
          error:
            "steps array must not be empty — add steps, run a successful record, or send recordedPlaywrightScript from the Record tab / record API.",
        });
        return;
      }

      // Universal Test Step Intelligence: normalize → repair → validate → intent completion
      // (Skip if steps already came from Playwright → DSL pipeline above.)
      if (!skipSecondStepNormalizer) {
        const normalized = runUniversalTestStepIntelligence({ input: steps, platform });
        if (normalized.errors.length > 0) {
          res.status(422).json({
            error: "Steps could not be safely normalized into the Test DSL (no guessing).",
            stepNormalizationErrors: normalized.errors,
            stepNormalizationWarnings: normalized.warnings,
            dsl: normalized.dsl,
          });
          return;
        }
        steps = normalized.canonicalSteps;
      }

      let autoLocatorsText = "";
      const pageLocale = parsePageLocale(body.pageLocale);
      if (body.autoDetectLocators === true && body.url?.trim()) {
        try {
          const extracted = await extractLocators(body.url.trim(), pageLocale);
          const forPrompt = filterLocatorsBySteps(extracted, steps);
          autoLocatorsText = formatLocatorResultsAsLines(forPrompt);
        } catch (err) {
          console.warn("[generate] auto-detect locators skipped:", err);
        }
      }

      let locatorSanitizeWarnings: string[] = [];
      if (platform === "web") {
        const su = sanitizeKatalonLocatorLines(userLocatorsText, { platform, url: body.url?.trim() });
        const sa = sanitizeKatalonLocatorLines(autoLocatorsText, { platform, url: body.url?.trim() });
        userLocatorsText = su.text;
        autoLocatorsText = sa.text;
        locatorSanitizeWarnings = [...su.warnings, ...sa.warnings];
      }
      const mergedLocators = mergeLocatorTexts(userLocatorsText, autoLocatorsText);
      const useDeterministicCompiler = body.deterministicCompiler !== false;

      if (preserveRecordingFidelity && pipelineDsl && pipelineDsl.length > 0 && platform === "web") {
        selectorTraceReport = validateDslSelectorsTraceableInLocatorText(pipelineDsl, mergedLocators);
        if (!selectorTraceReport.ok) {
          res.status(422).json({
            error: selectorTraceReport.message ?? "Selector binding validation failed",
            selectorTraceFailures: selectorTraceReport.failures,
            ...(selectorTraceReport.warnings?.length
              ? { selectorTraceWarnings: selectorTraceReport.warnings }
              : {}),
            recordingFidelity: {
              preserveRecordingFidelity,
              selectorTraceability: false,
            },
          });
          return;
        }
      }

      if (useDeterministicCompiler) {
        let selectorByTestObjectLabel: Record<string, string> | undefined;
        if (pipelineDsl && platform === "web") {
          const map: Record<string, string> = {};
          for (const s of pipelineDsl) {
            const t = s.target?.trim();
            const sel = s.context?.selector;
            if (!t || typeof sel !== "string" || !sel.trim()) continue;
            const v = sel.trim();
            map[t] = v;
            const nfc = t.normalize("NFC");
            if (nfc !== t) map[nfc] = v;
          }
          if (Object.keys(map).length > 0) selectorByTestObjectLabel = map;
        }
        const playwrightContextSelectors =
          pipelineDsl && platform === "web" && pipelineDsl.length === steps.length
            ? pipelineDsl.map((s) =>
                typeof s.context?.selector === "string" ? s.context.selector.trim() : undefined
              )
            : undefined;
        const compiled = compileKatalonScript({
          platform,
          steps,
          locatorsText: mergedLocators,
          url: body.url?.trim(),
          testCaseName: body.testCaseName,
          ...(selectorByTestObjectLabel && Object.keys(selectorByTestObjectLabel).length > 0
            ? { selectorByTestObjectLabel }
            : {}),
          ...(playwrightContextSelectors ? { playwrightContextSelectors } : {}),
        });
        if (compiled.validationErrors.length > 0) {
          const stage = compiled.validationStage;
          const message =
            stage === "compile"
              ? "Compiler could not resolve one or more steps to locators (see validationErrors)."
              : stage === "groovy"
                ? "Generated Groovy failed post-generation validation (see validationErrors)."
                : "Generated script failed validation";
          res.status(422).json({
            error: message,
            validationErrors: compiled.validationErrors,
            validationStage: stage,
            compilerWarnings: compiled.warnings,
          });
          return;
        }
        let code = compiled.code;
        if (body.stylePass === "simplify") {
          code = simplifyGroovyFormatting(code);
        }
        if (!preserveRecordingFidelity) {
          code = enforceExecutionDependencies(code, { platform });
          code = optimizeWithExecutionState(code, { platform });
          code = optimizeGroovyExecution(code, { platform });
        }
        const knownOr = new Set(mergedOrList);
        const lint = lintGroovy(code, knownOr, { platform });
        try {
          await appendHistory({
            platform,
            model: compiled.model,
            testCaseName: body.testCaseName,
            stepsPreview: steps.join(" | ").slice(0, 200),
            code,
          });
        } catch (histErr) {
          console.warn("[generate] history append failed (generation still succeeded):", histErr);
        }
        if (body.stream) {
          res.setHeader("Content-Type", "text/plain; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache");
          res.write(code);
          res.end();
          return;
        }
        res.json({
          code,
          model: compiled.model,
          platform,
          lint,
          compilerWarnings: compiled.warnings,
          deterministic: true,
          ...(locatorSanitizeWarnings.length > 0 ? { locatorSanitizeWarnings } : {}),
          ...(selectorTraceReport?.warnings?.length
            ? { selectorTraceWarnings: selectorTraceReport.warnings }
            : {}),
          ...(typeof playwrightParseActionCount === "number"
            ? {
                recordingFidelity: {
                  ...compareRecordingToDslSteps(playwrightParseActionCount, steps.length),
                  preserveRecordingFidelity,
                  ...(preserveRecordingFidelity && pipelineDsl?.length && platform === "web"
                    ? { selectorTraceability: true as const }
                    : {}),
                },
              }
            : {}),
          ...healingPayload(body),
        });
        return;
      }

      const llm = resolveLlm(body);
      const geminiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
      if (llm === "gemini" && !geminiKey) {
        res.status(503).json({
          error:
            'Gemini is selected but the server has no GEMINI_API_KEY. Add it to server/.env (or root .env), restart the backend, and try again. Keys are not accepted from the browser.',
        });
        return;
      }

      const model =
        body.model?.trim() ||
        (llm === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OLLAMA_MODEL);
      const prompt = buildKatalonPrompt({
        platform,
        steps,
        userLocatorsText,
        autoLocatorsText,
        testCaseName: body.testCaseName,
        recordedPlaywrightScript: recordedPlaywrightScript || undefined,
        katalonProjectContext,
        promptExtras,
      });

      if (body.stream) {
        let headersSent = false;
        let full = "";
        try {
          const stream =
            llm === "gemini"
              ? streamGemini({ model, prompt, apiKey: geminiKey })
              : streamOllama({ model, prompt });
          for await (const chunk of stream) {
            full += chunk;
          }
          let out = full.trim();
          if (platform === "web") {
            out = normalizeKatalonWebGroovy(out);
          }
          if (body.stylePass === "simplify") {
            out = simplifyGroovyFormatting(out);
          }
          if (!preserveRecordingFidelity) {
            out = enforceExecutionDependencies(out, { platform });
            out = optimizeWithExecutionState(out, { platform });
            out = optimizeGroovyExecution(out, { platform });
          }
          if (out.length > 0) {
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
            headersSent = true;
            res.write(out);
            res.end();
            await appendHistory({
              platform,
              model,
              testCaseName: body.testCaseName,
              stepsPreview: steps.join(" | ").slice(0, 200),
              code: out,
            });
          } else {
            res.status(502).json({
              error: llm === "gemini" ? "Gemini returned an empty stream" : "Ollama returned an empty stream",
            });
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

      const result =
        llm === "gemini"
          ? await generateWithGemini({ model, prompt, apiKey: geminiKey })
          : await generateWithOllama({ model, prompt });
      let code = result.response.trim();
      if (platform === "web") {
        code = normalizeKatalonWebGroovy(code);
      }
      if (body.stylePass === "simplify") {
        code = simplifyGroovyFormatting(code);
      }
      if (!preserveRecordingFidelity) {
        code = enforceExecutionDependencies(code, { platform });
        code = optimizeWithExecutionState(code, { platform });
        code = optimizeGroovyExecution(code, { platform });
      }

      const knownOr = new Set(mergedOrList);
      const lint = lintGroovy(code, knownOr, { platform });

      try {
        await appendHistory({
          platform,
          model,
          testCaseName: body.testCaseName,
          stepsPreview: steps.join(" | ").slice(0, 200),
          code,
        });
      } catch (histErr) {
        console.warn("[generate] history append failed (generation still succeeded):", histErr);
      }

      res.json({
        code,
        model: result.model,
        platform,
        lint,
        ...(locatorSanitizeWarnings.length > 0 ? { locatorSanitizeWarnings } : {}),
        ...(selectorTraceReport?.warnings?.length
          ? { selectorTraceWarnings: selectorTraceReport.warnings }
          : {}),
        ...(typeof playwrightParseActionCount === "number"
          ? {
              recordingFidelity: {
                ...compareRecordingToDslSteps(playwrightParseActionCount, steps.length),
                preserveRecordingFidelity,
                ...(preserveRecordingFidelity && pipelineDsl?.length && platform === "web"
                  ? { selectorTraceability: true as const }
                  : {}),
              },
            }
          : {}),
        ...healingPayload(body),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(msg)) {
        const ollamaBase =
          process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:11434";
        const body = req.body as GenerateRequestBody;
        const errLlm = resolveLlm(body);
        const errModel =
          body.model?.trim() ||
          (errLlm === "gemini" ? DEFAULT_GEMINI_MODEL : DEFAULT_OLLAMA_MODEL);
        const modelHint =
          errLlm === "gemini"
            ? "Gemini: set GEMINI_API_KEY in server/.env and restart the backend."
            : `Ollama: run \`ollama serve\`, pull the model (\`ollama pull ${errModel}\`), and set OLLAMA_BASE_URL in server/.env (use http://127.0.0.1:11434 on Windows if you see fetch failed).`;
        res.status(503).json({
          error: `LLM backend unreachable (${msg}). ${modelHint} This server uses OLLAMA_BASE_URL=${ollamaBase}. Quick check: open ${ollamaBase}/api/tags in a browser.`,
        });
        return;
      }
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
        rawSteps: result.rawSteps,
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
      const body = req.body as { url?: string; steps?: unknown; pageLocale?: unknown };
      const url = body?.url;
      if (!url || typeof url !== "string" || !url.trim()) {
        res.status(400).json({ error: "url is required" });
        return;
      }
      const pageLocale = parsePageLocale(body.pageLocale);
      const stepLines = Array.isArray(body.steps)
        ? body.steps.map((s) => String(s).trim()).filter(Boolean)
        : [];
      const extracted = await extractLocators(url.trim(), pageLocale);
      const locators =
        stepLines.length > 0 ? filterLocatorsBySteps(extracted, stepLines) : extracted;
      res.json({ locators });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/locators-playwright", async (req, res) => {
    try {
      req.setTimeout(180_000);
      res.setTimeout(180_000);
      const body = req.body as { url?: string; pageLocale?: unknown };
      const url = body?.url;
      if (!url || typeof url !== "string" || !url.trim()) {
        res.status(400).json({ error: "url is required" });
        return;
      }
      const pageLocale = parsePageLocale(body.pageLocale);
      const lines = await extractPlaywrightLocatorLines(url.trim(), { locale: pageLocale });
      res.json({ lines });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  /** Normalize Playwright / Selenium / Cypress locator lines to Katalon CSS/XPath only. */
  router.post("/convert-locators", (req, res, next) => {
    try {
      const body = req.body as { locators?: unknown; url?: unknown };
      if (!Array.isArray(body.locators)) {
        res.status(400).json({
          error: "locators must be an array of strings (each line: Label = selector)",
        });
        return;
      }
      const locators = body.locators.map((x) => String(x).trim()).filter(Boolean);
      const url = typeof body.url === "string" ? body.url.trim() : undefined;
      const { results, lines, errors } = convertLocatorLines(locators, { pageUrl: url });
      res.json({ results, lines, errors });
    } catch (e) {
      next(e);
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
      const testCaseRows = parseTestCaseCsvRows(text);
      if (testCaseRows?.length) {
        const steps = testCaseRows.flatMap((r) => r.stepLines);
        res.json({
          format: "test-cases" as const,
          rows: testCaseRows.map((r) => ({
            sourceRowIndex: r.sourceRowIndex,
            testCaseId: r.testCaseId,
            title: r.title,
            stepLines: r.stepLines,
          })),
          steps,
          rowCount: testCaseRows.length,
        });
        return;
      }
      const parsed = parseTestStepsCsv(text);
      const steps = parsedStepsToStrings(parsed);
      res.json({ format: "simple" as const, steps, rowCount: parsed.length });
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

  router.post(
    "/katalon/upload",
    uploadKatalon.fields([
      { name: "archive", maxCount: 1 },
      { name: "orFiles", maxCount: 5000 },
      { name: "testCaseFiles", maxCount: 200 },
      { name: "testSuiteFiles", maxCount: 200 },
    ]),
    (req, res) => {
      try {
        const bag = req.files as
          | Record<string, Express.Multer.File[]>
          | Express.Multer.File[]
          | undefined;
        const filesRecord =
          bag && !Array.isArray(bag) ? bag : undefined;
        const archive = filesRecord?.archive?.[0];
        const orFiles = filesRecord?.orFiles ?? [];
        const testCaseFiles = filesRecord?.testCaseFiles ?? [];
        const testSuiteFiles = filesRecord?.testSuiteFiles ?? [];
        if (
          !archive &&
          orFiles.length === 0 &&
          testCaseFiles.length === 0 &&
          testSuiteFiles.length === 0
        ) {
          res.status(400).json({
            error:
              "Send 'archive' (.zip) and/or file fields: 'orFiles' (.rs/.xml), 'testCaseFiles' (.groovy/.tc), 'testSuiteFiles' (.ts from Test Suites).",
          });
          return;
        }
        const orPaths = new Set<string>();
        const tcPaths = new Set<string>();
        const tsPaths = new Set<string>();
        if (archive?.buffer) {
          const name = archive.originalname?.toLowerCase() ?? "";
          if (!name.endsWith(".zip")) {
            res.status(400).json({ error: "archive must be a .zip file" });
            return;
          }
          for (const p of extractObjectRepositoryPathsFromZip(archive.buffer)) orPaths.add(p);
          for (const p of extractTestCasePathsFromZip(archive.buffer)) tcPaths.add(p);
          for (const p of extractTestSuitePathsFromZip(archive.buffer)) tsPaths.add(p);
        }
        for (const p of extractPathsFromUploadedOrFiles(orFiles)) orPaths.add(p);
        for (const p of extractPathsFromUploadedTestCaseFiles(testCaseFiles)) tcPaths.add(p);
        for (const p of extractPathsFromUploadedTestSuiteFiles(testSuiteFiles)) tsPaths.add(p);

        const objectRepositoryPaths = [...orPaths].sort((a, b) => a.localeCompare(b));
        const testCasePaths = [...tcPaths].sort((a, b) => a.localeCompare(b));
        const testSuitePaths = [...tsPaths].sort((a, b) => a.localeCompare(b));
        res.json({
          objectRepositoryPaths,
          testCasePaths,
          testSuitePaths,
          counts: {
            objectRepository: objectRepositoryPaths.length,
            testCases: testCasePaths.length,
            testSuites: testSuitePaths.length,
          },
          count: objectRepositoryPaths.length,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        res.status(400).json({ error: msg });
      }
    }
  );

  router.post("/katalon/match-or", (req, res) => {
    try {
      const b = req.body as {
        steps?: unknown;
        objectRepositoryPaths?: unknown;
      };
      if (!Array.isArray(b.steps) || !Array.isArray(b.objectRepositoryPaths)) {
        res.status(400).json({ error: "steps and objectRepositoryPaths must be JSON arrays" });
        return;
      }
      const stepList = b.steps.map((x) => String(x).trim()).filter(Boolean);
      const pathList = b.objectRepositoryPaths.map((x) => String(x).trim()).filter(Boolean);
      res.json({ matches: matchStepsToOr(stepList, pathList) });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
