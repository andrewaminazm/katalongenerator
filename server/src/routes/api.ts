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
import { gosiBrainGenerate, GosiBrainAuthError, streamGosiBrain } from "../services/gosiBrain.js";
import {
  parseTestStepsCsv,
  parsedStepsToStrings,
  parseTestCaseCsvRows,
} from "../services/csvParser.js";
import {
  getJiraIssue,
  getJiraMyself,
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
import {
  analyzeGenerationMode,
  routeSpecializedGeneration,
  type UserGenerationMode,
} from "../services/groovyGenerator/generationModeRouter.js";
import {
  loadProjectIndex,
} from "../services/projectIntelligence/index.js";
import {
  bindingsByStepIndex,
  buildGenerationPlan,
  enrichLocatorsFromSteps,
  mergeLocatorTextWithPlan,
} from "../services/projectIntelligence/generationPlanner.js";
import { extractProjectDefaultUrl } from "../services/projectIntelligence/projectUrlResolver.js";
import { extractKeywordRefFromStep } from "../services/projectIntelligence/stepReferenceExtractor.js";
import type { ProjectGenerationMode } from "../services/projectIntelligence/types.js";
import type { ProjectIndex } from "../services/projectIntelligence/types.js";
import {
  buildMemoryContextForGeneration,
  computeStyleMatchReport,
  resolveAiMemoryMode,
  shouldInjectMemory,
  type AiMemoryMode,
} from "../services/aiMemory/index.js";
import type { GenerationStyleContext } from "../services/aiMemory/types.js";
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
import {
  AppiumConnectionError,
  pingAppiumServer,
  startAppiumSession,
  stopAppiumSession,
  getAppiumPageSource,
  getAppiumSession,
} from "../services/mobile/appiumClient.js";
import { parseMobilePageSource } from "../services/mobile/mobileSourceParser.js";
import { extractMobileLocatorLines } from "../services/mobile/mobileLocatorExtractor.js";
import {
  startAppiumRecordProxy,
  stopAppiumRecordProxy,
  convertCommandsToMobileArtifacts,
  type AppiumProxyRecording,
} from "../services/mobile/appiumRecordProxy.js";
import { isGosiBrainConfigured, gosiBrainConfigHint } from "../loadEnv.js";
import { runOrchestration } from "../services/aiOrchestrator/index.js";
import type { OrchestrationMode } from "../services/aiOrchestrator/types.js";
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

const DEFAULT_GOSI_BRAIN_MODEL =
  process.env.GOSI_BRAIN_MODEL || "qwen3-vl-30b-a3b-instruct-fp8";

function resolveLlm(_body: GenerateRequestBody): LlmProvider {
  return "gosi-brain";
}

function resolveGosiAuthorizationToken(body: GenerateRequestBody): string | null {
  const fromBody = body.authorization_token?.trim();
  if (fromBody) return fromBody;
  const fromEnv = process.env.GOSI_BRAIN_AUTHORIZATION_TOKEN?.trim();
  return fromEnv || null;
}

function normalizeSteps(body: GenerateRequestBody): string[] {
  const raw = body.steps;
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => String(s).trim()).filter(Boolean);
}

function parseUserGenerationMode(raw: unknown): UserGenerationMode {
  const allowed: UserGenerationMode[] = [
    "auto",
    "test_script",
    "custom_keyword",
    "groovy_function",
    "utility_class",
    "framework_helper",
    "page_object",
    "api_helper",
    "db_utility",
    "framework_service",
  ];
  if (typeof raw === "string" && (allowed as string[]).includes(raw)) {
    return raw as UserGenerationMode;
  }
  return "auto";
}

function aiMemoryResponseExtras(
  code: string,
  mode: AiMemoryMode,
  memoryContext: GenerationStyleContext | null
): Record<string, unknown> {
  if (!memoryContext || mode === "disabled" || mode === "learn_only") {
    return mode !== "disabled" ? { aiMemory: { mode } } : {};
  }
  const styleMatch = computeStyleMatchReport(code, memoryContext.profile);
  return {
    aiMemory: { mode, styleMatch },
    ...(memoryContext.styleMatchHints.length > 0
      ? { aiMemorySuggestions: memoryContext.styleMatchHints }
      : {}),
  };
}

async function finishSpecializedGeneration(
  res: express.Response,
  body: GenerateRequestBody,
  platform: Platform,
  steps: string[],
  routed: Awaited<ReturnType<typeof routeSpecializedGeneration>>,
  memoryContext: GenerationStyleContext | null = null,
  aiMemoryMode: AiMemoryMode = "disabled"
): Promise<boolean> {
  if (!routed.handled) return false;
  if (routed.validationErrors && routed.validationErrors.length > 0) {
    res.status(422).json({
      error: "Generated code failed validation (see validationErrors).",
      validationErrors: routed.validationErrors,
      validationStage: routed.validationStage,
      generationMode: routed.generationMode,
      compilerWarnings: routed.warnings,
    });
    return true;
  }
  let code = routed.code ?? "";
  if (body.stylePass === "simplify") {
    code = simplifyGroovyFormatting(code);
  }
  const isUtility =
    routed.generationMode === "groovy_utility" || routed.generationMode === "hybrid";
  const lint = lintGroovy(code, new Set(), {
    platform,
    keywordTemplate: routed.generationMode === "keyword_template",
    groovyUtility: isUtility,
  });
  try {
    await appendHistory({
      platform,
      model: routed.model ?? "specialized",
      testCaseName: body.testCaseName,
      stepsPreview: steps.join(" | ").slice(0, 200),
      code,
    });
  } catch (histErr) {
    console.warn("[generate] history append failed (specialized):", histErr);
  }
  if (body.stream) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.write(code);
    res.end();
    return true;
  }
  res.json({
    code,
    model: routed.model,
    platform,
    lint,
    compilerWarnings: routed.warnings,
    deterministic: true,
    generationMode: routed.generationMode,
    ...(routed.keywordTemplate?.keywordTemplate
      ? { keywordTemplate: routed.keywordTemplate.keywordTemplate }
      : {}),
    ...(routed.groovyUtility ? { groovyUtility: routed.groovyUtility } : {}),
    ...aiMemoryResponseExtras(code, aiMemoryMode, memoryContext),
    ...healingPayload(body),
  });
  return true;
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

/** Maps Appium connectivity failures to 503; session rejected by Appium to 400. */
function respondMobileAppiumError(
  res: express.Response,
  e: unknown,
  opts?: { sessionStart?: boolean }
): boolean {
  if (e instanceof AppiumConnectionError) {
    res.status(503).json({ error: e.message, code: "APPIUM_UNREACHABLE" });
    return true;
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (opts?.sessionStart && msg.startsWith("Could not start Appium session")) {
    res.status(400).json({ error: msg, code: "APPIUM_SESSION_REJECTED" });
    return true;
  }
  res.status(500).json({ error: msg });
  return true;
}

let activeMobileRecording: AppiumProxyRecording | null = null;

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.get("/health", (req, res) => {
    const gosiBrainConfigured = isGosiBrainConfigured();
    const apiBase =
      typeof req.get("x-forwarded-host") === "string"
        ? `https://${req.get("x-forwarded-host")}`
        : "";
    res.json({
      ok: true,
      gosiBrainConfigured,
      defaultGosiBrainModel: DEFAULT_GOSI_BRAIN_MODEL,
      ...(gosiBrainConfigured
        ? {}
        : { gosiConfigHint: gosiBrainConfigHint(apiBase) }),
    });
  });

  /** GET ?url= — check Appium /status without creating a session (always 200 + JSON). */
  router.get("/mobile/appium/ping", async (req, res) => {
    try {
      const appiumUrl = String(req.query.url ?? "").trim();
      if (!appiumUrl) {
        res.status(400).json({ ok: false, error: "Query parameter url is required" });
        return;
      }
      const result = await pingAppiumServer(appiumUrl);
      res.json(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ ok: false, error: msg });
    }
  });

  router.post("/mobile/session/start", async (req, res) => {
    try {
      const appiumUrl = String(req.body?.appiumUrl ?? "").trim();
      const capabilities = req.body?.capabilities;
      if (!appiumUrl) {
        res.status(400).json({ error: "appiumUrl is required" });
        return;
      }
      if (!capabilities || typeof capabilities !== "object" || Array.isArray(capabilities)) {
        res.status(400).json({ error: "capabilities must be a JSON object (not an array)" });
        return;
      }
      const r = await startAppiumSession({
        appiumUrl,
        capabilities: capabilities as Record<string, unknown>,
      });
      const platformName = String((r.capabilities as any)?.platformName ?? "").toLowerCase();
      const platform =
        platformName.includes("android") ? "android" : platformName.includes("ios") ? "ios" : "unknown";
      res.json({
        sessionId: r.sessionId,
        platformName: platform,
        capabilities: r.capabilities,
      });
    } catch (e) {
      respondMobileAppiumError(res, e, { sessionStart: true });
    }
  });

  router.post("/mobile/session/stop", async (req, res) => {
    try {
      const appiumUrl = String(req.body?.appiumUrl ?? "").trim();
      const sessionId = String(req.body?.sessionId ?? "").trim();
      if (!appiumUrl || !sessionId) {
        res.status(400).json({ error: "Requires { appiumUrl, sessionId }" });
        return;
      }
      await stopAppiumSession({ appiumUrl, sessionId });
      res.json({ ok: true });
    } catch (e) {
      respondMobileAppiumError(res, e);
    }
  });

  router.post("/mobile/locators", async (req, res) => {
    try {
      const appiumUrl = String(req.body?.appiumUrl ?? "").trim();
      const sessionId = String(req.body?.sessionId ?? "").trim();
      if (!appiumUrl || !sessionId) {
        res.status(400).json({ error: "Requires { appiumUrl, sessionId }" });
        return;
      }
      const src = await getAppiumPageSource({ appiumUrl, sessionId });
      let parsed: ReturnType<typeof parseMobilePageSource>;
      try {
        parsed = parseMobilePageSource(src);
      } catch (parseErr) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        res.status(422).json({
          error: `Could not parse Appium page source as XML: ${msg}`,
          code: "PAGE_SOURCE_PARSE_FAILED",
        });
        return;
      }
      const locs = extractMobileLocatorLines(parsed.nodes);
      const session = await getAppiumSession({ appiumUrl, sessionId }).catch(() => ({}));
      res.json({
        platform: parsed.platform,
        session,
        locators: locs,
      });
    } catch (e) {
      respondMobileAppiumError(res, e);
    }
  });

  router.post("/mobile/record/start", async (req, res) => {
    try {
      const targetAppiumUrl = String(req.body?.appiumUrl ?? "").trim();
      if (!targetAppiumUrl) {
        res.status(400).json({ error: "appiumUrl is required" });
        return;
      }
      if (activeMobileRecording) {
        res.status(409).json({ error: "A mobile recording is already active. Stop it first." });
        return;
      }
      const rec = await startAppiumRecordProxy({ targetAppiumUrl });
      activeMobileRecording = rec;
      res.json({ proxyUrl: rec.proxyUrl, recordingId: rec.id });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.post("/mobile/record/stop", async (_req, res) => {
    try {
      if (!activeMobileRecording) {
        res.status(400).json({ error: "No active mobile recording" });
        return;
      }
      const rec = activeMobileRecording;
      activeMobileRecording = null;
      await stopAppiumRecordProxy(rec);
      const artifacts = convertCommandsToMobileArtifacts(rec.commands);
      res.json({
        steps: artifacts.steps,
        locatorsText: artifacts.locatorsText,
        rawCommands: rec.commands,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
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
      const rawBody = req.body as Record<string, unknown>;
      const authorizationToken =
        typeof rawBody.authorization_token === "string" && rawBody.authorization_token.trim()
          ? rawBody.authorization_token.trim()
          : (process.env.GOSI_BRAIN_AUTHORIZATION_TOKEN?.trim() ?? undefined);
      const result = await runLocatorHealing({
        url,
        failure,
        maxRetries,
        skipAi: Boolean(req.body?.skipAi),
        authorizationToken,
      });
      res.json(result);
    } catch (e) {
      if (e instanceof GosiBrainAuthError) {
        res.status(401).json({ error: e.message, code: e.code });
        return;
      }
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

  router.post("/orchestrate", async (req, res, next) => {
    try {
      const body = req.body as GenerateRequestBody & { prompt?: string };
      const platform = body.platform;
      if (!validatePlatform(platform)) {
        res.status(400).json({ error: "platform must be 'web' or 'mobile'" });
        return;
      }
      const steps = normalizeSteps(body);
      const prompt =
        (typeof body.prompt === "string" && body.prompt.trim()) ||
        steps.join("\n") ||
        "";
      if (!prompt.trim()) {
        res.status(400).json({ error: "prompt or steps are required" });
        return;
      }
      const rawBody = req.body as Record<string, unknown>;
      const authorizationToken =
        typeof rawBody.authorization_token === "string" && rawBody.authorization_token.trim()
          ? rawBody.authorization_token.trim()
          : (process.env.GOSI_BRAIN_AUTHORIZATION_TOKEN?.trim() ?? undefined);

      const result = await runOrchestration({
        platform,
        prompt,
        steps,
        locators: body.locators,
        url: body.url,
        projectId: body.projectId,
        projectGenerationMode: body.projectGenerationMode,
        codeGenerationMode: body.codeGenerationMode,
        aiMemoryMode: body.aiMemoryMode,
        orchestrationMode: (body.orchestrationMode ?? "advanced") as OrchestrationMode,
        deterministicCompiler: body.deterministicCompiler,
        authorizationToken,
        model: body.model,
        testCaseName: body.testCaseName,
        stylePass: body.stylePass,
      });

      res.json({
        code: result.code,
        model: result.model,
        ok: result.ok,
        intent: result.intent,
        plan: result.plan,
        artifacts: result.artifacts,
        warnings: result.warnings,
        lint: result.lint,
        confidence: result.confidence,
        orchestration: result.orchestration,
        conversationalResponse: result.conversationalResponse,
        suggestions: result.suggestions,
        generationMode: result.generationMode,
        groovyUtility: result.groovyUtility,
        keywordTemplate: result.keywordTemplate,
      });
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

      if (body.orchestrationMode) {
        const prompt =
          (typeof body.prompt === "string" && body.prompt.trim()) ||
          steps.join("\n") ||
          "";
        if (!prompt.trim()) {
          res.status(400).json({ error: "prompt or steps are required when orchestrationMode is set" });
          return;
        }
        const rawBody = req.body as Record<string, unknown>;
        const authorizationToken =
          typeof rawBody.authorization_token === "string" && rawBody.authorization_token.trim()
            ? rawBody.authorization_token.trim()
            : (process.env.GOSI_BRAIN_AUTHORIZATION_TOKEN?.trim() ?? undefined);
        const orch = await runOrchestration({
          platform,
          prompt,
          steps,
          locators: body.locators,
          url: body.url,
          projectId: body.projectId,
          projectGenerationMode: body.projectGenerationMode,
          codeGenerationMode: body.codeGenerationMode,
          aiMemoryMode: body.aiMemoryMode,
          orchestrationMode: body.orchestrationMode as OrchestrationMode,
          deterministicCompiler: body.deterministicCompiler,
          authorizationToken,
          model: body.model,
          testCaseName: body.testCaseName,
          stylePass: body.stylePass,
        });
        res.json({
          code: orch.code,
          model: orch.model,
          platform,
          lint: orch.lint,
          compilerWarnings: orch.warnings,
          deterministic: body.deterministicCompiler !== false,
          orchestrator: {
            ok: orch.ok,
            intent: orch.intent,
            plan: orch.plan,
            confidence: orch.confidence,
            orchestration: orch.orchestration,
            conversationalResponse: orch.conversationalResponse,
            suggestions: orch.suggestions,
            artifacts: orch.artifacts,
          },
          ...(orch.generationMode ? { generationMode: orch.generationMode } : {}),
          ...(orch.groovyUtility ? { groovyUtility: orch.groovyUtility } : {}),
          ...(orch.keywordTemplate ? { keywordTemplate: orch.keywordTemplate } : {}),
        });
        return;
      }

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

      const useDeterministicCompiler = body.deterministicCompiler !== false;
      const userGenMode = parseUserGenerationMode(body.codeGenerationMode);
      const gosiTokenEarly = resolveGosiAuthorizationToken(body);

      let projectDefaultUrl: string | undefined;
      const projectIdForUrl = body.projectId?.trim();
      if (projectIdForUrl) {
        try {
          projectDefaultUrl = await extractProjectDefaultUrl(projectIdForUrl);
        } catch (urlErr) {
          console.warn("[generate] project default URL extraction failed:", urlErr);
        }
      }

      // Universal Test Step Intelligence: normalize → repair → validate → intent completion
      // (Skip if steps already came from Playwright → DSL pipeline above.)
      if (!skipSecondStepNormalizer) {
        const stepsBeforeNormalize = steps.slice();
        const normalized = runUniversalTestStepIntelligence({
          input: steps,
          platform,
          projectDefaultUrl,
        });
        if (normalized.errors.length > 0) {
          res.status(422).json({
            error: "Steps could not be safely normalized into the Test DSL (no guessing).",
            stepNormalizationErrors: normalized.errors,
            stepNormalizationWarnings: normalized.warnings,
            dsl: normalized.dsl,
          });
          return;
        }
        steps = normalized.canonicalSteps.map((canonical, i) => {
          const original = stepsBeforeNormalize[i];
          if (original && extractKeywordRefFromStep(original)) {
            return original.trim();
          }
          return canonical;
        });
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
      let mergedLocators = mergeLocatorTexts(userLocatorsText, autoLocatorsText);
      mergedLocators = enrichLocatorsFromSteps(mergedLocators, steps, platform);
      let projectIntelligencePlan: ReturnType<typeof buildGenerationPlan> | undefined;
      let projectBindings: Record<number, { orPath?: string; orLabel?: string; keywordCall?: string }> | undefined;
      let projectKeywordsForCompile: import("../services/projectIntelligence/types.js").ParsedKeywordClass[] | undefined;
      let memoryContext: GenerationStyleContext | null = null;
      const projectId = body.projectId?.trim();
      const aiMemoryMode = resolveAiMemoryMode(
        body.aiMemoryMode ?? (projectId ? "learn_suggest" : "disabled")
      );

      if (projectId) {
        const index = await loadProjectIndex(projectId);
        if (!index) {
          res.status(404).json({ error: `Project not found: ${projectId}` });
          return;
        }
        const mode: ProjectGenerationMode =
          body.projectGenerationMode === "strict_reuse" ||
          body.projectGenerationMode === "generate_everything"
            ? body.projectGenerationMode
            : "balanced";
        projectKeywordsForCompile = index.keywords;
        if (!projectDefaultUrl) {
          try {
            projectDefaultUrl = await extractProjectDefaultUrl(projectId);
          } catch {
            /* optional */
          }
        }
        const compileDefaultUrl =
          body.url?.trim() || projectDefaultUrl?.trim() || undefined;
        projectIntelligencePlan = buildGenerationPlan(steps, index, mode, platform, {
          defaultUrl: compileDefaultUrl,
          projectDefaultUrl: projectDefaultUrl?.trim(),
        });
        mergedLocators = mergeLocatorTextWithPlan(mergedLocators, projectIntelligencePlan);
        const rawBindings = bindingsByStepIndex(projectIntelligencePlan);
        projectBindings = {};
        for (const [k, v] of Object.entries(rawBindings)) {
          const idx = Number(k);
          if (!Number.isFinite(idx)) continue;
          projectBindings[idx] = {
            orPath: v.orPath,
            orLabel: v.orLabel,
            keywordCall: v.keywordCall,
          };
        }

        memoryContext = await buildMemoryContextForGeneration(
          projectId,
          steps,
          index,
          aiMemoryMode
        );
        if (memoryContext && projectIntelligencePlan) {
          projectIntelligencePlan.suggestions = [
            ...(projectIntelligencePlan.suggestions ?? []),
            ...memoryContext.styleMatchHints,
          ];
        }
        if (memoryContext && shouldInjectMemory(aiMemoryMode)) {
          promptExtras.aiMemoryInjection = memoryContext.injectionText;
        }
      }

      if (useDeterministicCompiler) {
        const modeAnalysis = analyzeGenerationMode(steps, userGenMode);
        if (
          (modeAnalysis.mode === "groovy_utility" || modeAnalysis.mode === "keyword_template") &&
          modeAnalysis.mode !== "forced_wrap" &&
          !modeAnalysis.forcedWrapMode
        ) {
          const projectHint =
            projectKeywordsForCompile?.length &&
            projectKeywordsForCompile
              .map((k) => `Existing keyword class: ${k.customKeywordsPath}`)
              .slice(0, 12)
              .join("\n");
          const earlyRouted = await routeSpecializedGeneration({
            steps,
            userMode: userGenMode,
            platform,
            authorizationToken: gosiTokenEarly ?? undefined,
            model: body.model,
            projectHint: projectHint || undefined,
            aiMemoryInjection: promptExtras.aiMemoryInjection,
            projectKeywords: projectKeywordsForCompile,
          });
          if (
            await finishSpecializedGeneration(
              res,
              body,
              platform,
              steps,
              earlyRouted,
              memoryContext,
              aiMemoryMode
            )
          ) {
            return;
          }
        }
      }

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
        const compileDefaultUrl =
          body.url?.trim() || projectDefaultUrl?.trim() || undefined;
        const compileInput = {
          platform,
          steps,
          locatorsText: mergedLocators,
          url: compileDefaultUrl,
          testCaseName: body.testCaseName,
          ...(selectorByTestObjectLabel && Object.keys(selectorByTestObjectLabel).length > 0
            ? { selectorByTestObjectLabel }
            : {}),
          ...(playwrightContextSelectors ? { playwrightContextSelectors } : {}),
          ...(projectBindings && Object.keys(projectBindings).length > 0
            ? { projectBindingsByStepIndex: projectBindings }
            : {}),
          ...(projectKeywordsForCompile?.length
            ? { projectKeywords: projectKeywordsForCompile }
            : {}),
        };

        const hybridAnalysis = analyzeGenerationMode(steps, userGenMode);
        if (hybridAnalysis.mode === "forced_wrap" && hybridAnalysis.forcedWrapMode) {
          const projectHint =
            projectKeywordsForCompile?.length &&
            projectKeywordsForCompile
              .map((k) => `Existing keyword class: ${k.customKeywordsPath}`)
              .slice(0, 12)
              .join("\n");
          const forcedRouted = await routeSpecializedGeneration({
            steps,
            userMode: userGenMode,
            platform,
            authorizationToken: gosiTokenEarly ?? undefined,
            model: body.model,
            projectHint: projectHint || undefined,
            aiMemoryInjection: promptExtras.aiMemoryInjection,
            projectKeywords: projectKeywordsForCompile,
            compileTestInput: compileInput,
          });
          if (
            await finishSpecializedGeneration(
              res,
              body,
              platform,
              steps,
              forcedRouted,
              memoryContext,
              aiMemoryMode
            )
          ) {
            return;
          }
        }
        if (hybridAnalysis.mode === "hybrid") {
          const projectHint =
            projectKeywordsForCompile?.length &&
            projectKeywordsForCompile
              .map((k) => `Existing keyword class: ${k.customKeywordsPath}`)
              .slice(0, 12)
              .join("\n");
          const hybridRouted = await routeSpecializedGeneration({
            steps,
            userMode: userGenMode,
            platform,
            authorizationToken: gosiTokenEarly ?? undefined,
            model: body.model,
            projectHint: projectHint || undefined,
            aiMemoryInjection: promptExtras.aiMemoryInjection,
            projectKeywords: projectKeywordsForCompile,
            compileTestInput: compileInput,
          });
          if (
            await finishSpecializedGeneration(
              res,
              body,
              platform,
              steps,
              hybridRouted,
              memoryContext,
              aiMemoryMode
            )
          ) {
            return;
          }
        }

        const compiled = compileKatalonScript(compileInput);
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
          ...(projectIntelligencePlan
            ? {
                projectIntelligence: {
                  projectId: projectIntelligencePlan.projectId,
                  mode: projectIntelligencePlan.mode,
                  bindings: projectIntelligencePlan.bindings,
                  warnings: projectIntelligencePlan.warnings,
                  suggestions: projectIntelligencePlan.suggestions,
                },
              }
            : {}),
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
          ...aiMemoryResponseExtras(code, aiMemoryMode, memoryContext),
          ...healingPayload(body),
        });
        return;
      }

      const llm = resolveLlm(body);

      const gosiChatUrl = process.env.GOSI_BRAIN_CHAT_URL?.trim() ?? "";
      const gosiApiKey = process.env.GOSI_BRAIN_API_KEY?.trim() ?? "";
      if (!gosiChatUrl || !gosiApiKey) {
        res.status(503).json({
          error:
            "Server is missing GOSI_BRAIN_CHAT_URL or GOSI_BRAIN_API_KEY. Add them to server/.env and restart the backend.",
        });
        return;
      }

      const gosiToken = resolveGosiAuthorizationToken(body);
      if (!gosiToken) {
        res.status(401).json({ error: "authorization_token is required for Gosi Brain." });
        return;
      }

      const model = body.model?.trim() || DEFAULT_GOSI_BRAIN_MODEL;
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
        // Gosi Brain does not emit Ollama-format newline-delimited JSON chunks.
        // streamGosiBrain internally calls non-streaming and yields the full
        // response as a single chunk, so the SSE/stream path still works for
        // clients that use stream:true — they just get one large write instead
        // of incremental tokens.
        let headersSent = false;
        let full = "";
        try {
          const stream = streamGosiBrain({
            prompt,
            model,
            authorizationToken: gosiToken,
          });
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
            res.status(502).json({ error: "Gosi Brain returned an empty response." });
          }
        } catch (e) {
          if (e instanceof GosiBrainAuthError) {
            if (!headersSent) {
              res.status(401).json({ error: e.message, code: e.code });
            } else {
              res.end();
            }
            return;
          }
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

      const result = await gosiBrainGenerate({
        prompt,
        model,
        authorizationToken: gosiToken,
      });
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
        ...aiMemoryResponseExtras(code, aiMemoryMode, memoryContext),
        ...(projectIntelligencePlan
          ? {
              projectIntelligence: {
                projectId: projectIntelligencePlan.projectId,
                mode: projectIntelligencePlan.mode,
                bindings: projectIntelligencePlan.bindings,
                warnings: projectIntelligencePlan.warnings,
                suggestions: projectIntelligencePlan.suggestions,
              },
            }
          : {}),
        ...healingPayload(body),
      });
    } catch (e) {
      if (e instanceof GosiBrainAuthError) {
        res.status(401).json({ error: e.message, code: e.code });
        return;
      }
      const msg = e instanceof Error ? e.message : String(e);
      if (/fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(msg)) {
        res.status(503).json({
          error: `Gosi Brain unreachable (${msg}). Check GOSI_BRAIN_CHAT_URL in server/.env and make sure the server can reach the IWAI gateway.`,
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

  /** POST { credentials: { baseUrl, email, apiToken } } — calls Jira GET /myself to verify auth. */
  router.post("/jira/whoami", async (req, res, next) => {
    try {
      const c = (req.body as { credentials?: { baseUrl?: string; email?: string; apiToken?: string } })?.credentials;
      const baseUrl = typeof c?.baseUrl === "string" ? c.baseUrl.trim() : "";
      const email = typeof c?.email === "string" ? c.email.trim() : "";
      const apiToken = typeof c?.apiToken === "string" ? c.apiToken.trim() : "";
      if (!baseUrl || !email || !apiToken) {
        res.status(400).json({ error: "Provide credentials.baseUrl, credentials.email, and credentials.apiToken." });
        return;
      }
      try {
        const me = await getJiraMyself({ baseUrl, email, apiToken });
        res.json(me);
      } catch (e) {
        if (e instanceof JiraApiError) {
          res.status(e.statusCode).json({ error: e.message });
          return;
        }
        throw e;
      }
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
