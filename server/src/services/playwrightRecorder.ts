import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright";
import { parsePlaywrightScriptToDsl } from "./playwrightActionParser.js";

const __recDir = path.dirname(fileURLToPath(import.meta.url));

export interface RecorderLocator {
  name: string;
  selector: string;
}

/** Lossless mirror of captured browser events (no semantic renaming). */
export interface RecorderRawStep {
  action: "click" | "fill" | "navigate" | "change";
  selector?: string;
  url?: string;
  value?: string;
  timestamp?: number;
  tag?: string;
  text?: string;
  pageUrl?: string;
  reason?: string;
}

export interface RecorderResult {
  playwrightScript: string;
  steps: string[];
  locators: RecorderLocator[];
  rawSteps: RecorderRawStep[];
}

export interface RecorderEventPayload {
  type: "click" | "fill" | "navigate" | "change";
  /** May be empty for navigate steps (use url / pageUrl). */
  selector: string;
  tag?: string;
  text?: string;
  value?: string;
  pageUrl?: string;
  url?: string;
  timestamp?: number;
  reason?: string;
}

/** Current page URL during an active background recording (polled by GET /api/record/status). */
export const recordingProgress = { url: "" as string };

let sessionRunning = false;
let recordingJob: Promise<void> | null = null;
let lastRecordingResult: RecorderResult | null = null;
let lastRecordingError: Error | null = null;
/** Headed browser for the active session — used by cancel to unblock stuck "in progress" state. */
let recordingBrowser: Browser | null = null;

const DEFAULT_MAX_MS = 180_000;
/** Hard cap only to avoid OOM; must not silently drop normal sessions. */
const MAX_EVENTS = 100_000;

function recorderDebug(): boolean {
  const v = process.env.RECORD_RECORDER_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function getInjectPath(): string {
  const p = path.join(__recDir, "recorderInject.inbrowser.js");
  if (!existsSync(p)) {
    throw new Error(
      "recorderInject.inbrowser.js missing (expected next to playwrightRecorder.ts). Run npm run build from server/."
    );
  }
  return p;
}

function escapeJsString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Short preview for human-readable step lines (not for generated code strings). */
function previewForStepLine(s: string, maxLen: number): string {
  const t = s.replace(/\r\n|\r|\n/g, " ").replace(/"/g, "'");
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen - 1)}…`;
}

function uniqueLocatorName(hint: string, used: Set<string>): string {
  const base =
    hint
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 48) || "Element";
  let name = base;
  let n = 1;
  while (used.has(name.toLowerCase())) {
    name = `${base} (${++n})`;
  }
  used.add(name.toLowerCase());
  return name;
}

function syncProgressUrl(page: Page, publish: boolean) {
  if (!publish) return;
  try {
    recordingProgress.url = page.url();
  } catch {
    /* noop */
  }
}

/** Compare URLs for deduping consecutive navigations in emitted Playwright (strip hash only). */
function navKey(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    return x.href;
  } catch {
    return u;
  }
}

interface CapturedEvent {
  type: "click" | "fill" | "navigate" | "change";
  selector: string;
  tag?: string;
  text?: string;
  value?: string;
  pageUrl?: string;
  url?: string;
  timestamp?: number;
  reason?: string;
}

function toRawSteps(events: CapturedEvent[]): RecorderRawStep[] {
  return events.map((ev) => ({
    action: ev.type,
    selector: ev.selector || undefined,
    url: ev.url || (ev.type === "navigate" ? ev.pageUrl : undefined),
    value: ev.value,
    timestamp: ev.timestamp,
    tag: ev.tag,
    text: ev.text,
    pageUrl: ev.pageUrl,
    reason: ev.reason,
  }));
}

async function runRecordingSession(
  url: string,
  options: { maxDurationMs?: number; publishProgress: boolean }
): Promise<RecorderResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL must use http or https");
  }

  const maxMs = Math.min(options.maxDurationMs ?? DEFAULT_MAX_MS, 180_000);
  const publish = options.publishProgress;
  const dbg = recorderDebug();

  const events: CapturedEvent[] = [];
  let resolveFinish: (() => void) | null = null;
  const finishPromise = new Promise<void>((resolve) => {
    resolveFinish = resolve;
  });
  let finished = false;
  const safeFinish = () => {
    if (finished) return;
    finished = true;
    resolveFinish?.();
  };

  const browser = await chromium.launch({ headless: false });
  recordingBrowser = browser;
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();

    await page.exposeFunction("__pwRecorderEvent", (payload: RecorderEventPayload) => {
      if (events.length >= MAX_EVENTS) {
        if (dbg && events.length === MAX_EVENTS) {
          console.warn("[recorder] MAX_EVENTS reached; stopping capture to avoid OOM");
        }
        return;
      }
      if (dbg) console.log("RECORDED STEP:", payload);
      if (!payload) return;

      const ts = typeof payload.timestamp === "number" ? payload.timestamp : Date.now();

      if (payload.type === "navigate") {
        const u = (payload.url || payload.pageUrl || "").trim();
        if (!u) return;
        events.push({
          type: "navigate",
          selector: "",
          url: u,
          pageUrl: u,
          timestamp: ts,
          reason: payload.reason,
        });
        return;
      }

      const selRaw = typeof payload.selector === "string" ? payload.selector.trim() : "";
      const sel = selRaw.length > 0 ? selRaw : "xpath=//*";

      if (payload.type === "change" || payload.type === "fill") {
        events.push({
          type: payload.type === "change" ? "change" : "fill",
          selector: sel,
          tag: payload.tag,
          text: payload.text,
          value: payload.value,
          pageUrl: payload.pageUrl,
          timestamp: ts,
        });
        return;
      }

      events.push({
        type: "click",
        selector: sel,
        tag: payload.tag,
        text: payload.text,
        pageUrl: payload.pageUrl,
        timestamp: ts,
      });
    });
    await page.exposeFunction("__pwRecorderFinish", () => {
      safeFinish();
    });
    await page.exposeFunction("__pwRecorderUrl", (nextUrl: string) => {
      if (typeof nextUrl === "string" && publish) {
        recordingProgress.url = nextUrl;
      }
    });

    await page.addInitScript({ path: getInjectPath() });
    page.on("dialog", (d) => d.dismiss().catch(() => undefined));

    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) {
        syncProgressUrl(page, publish);
      }
    });

    recordingProgress.url = parsed.href;
    await page.goto(parsed.href, { waitUntil: "domcontentloaded", timeout: 30_000 });
    syncProgressUrl(page, publish);

    await Promise.race([
      finishPromise,
      new Promise<void>((resolve) => setTimeout(resolve, maxMs)),
    ]);
    syncProgressUrl(page, publish);
  } finally {
    if (recordingBrowser === browser) recordingBrowser = null;
    await context?.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }

  const scriptLines: string[] = [];
  const steps: string[] = [];
  let stepNum = 1;
  let lastNavKey: string | null = null;

  const emitGotoIfNeeded = (rawUrl: string) => {
    const key = navKey(rawUrl);
    if (lastNavKey !== null && key === lastNavKey) return;
    lastNavKey = key;
    scriptLines.push(`await page.goto('${escapeJsString(rawUrl)}');`);
    steps.push(`${stepNum++}. Navigate to ${rawUrl}`);
  };

  if (events.length === 0) {
    emitGotoIfNeeded(parsed.href);
  } else {
    for (const ev of events) {
      if (ev.type === "navigate") {
        const u = ev.url?.trim() || ev.pageUrl?.trim() || parsed.href;
        // One Playwright goto per recorded navigation event (lossless; do not merge SPA navigations).
        scriptLines.push(`await page.goto('${escapeJsString(u)}');`);
        const why = ev.reason ? ` (${ev.reason})` : "";
        steps.push(`${stepNum++}. Navigate to ${u}${why}`);
        lastNavKey = navKey(u);
        continue;
      }

      const at = ev.pageUrl?.trim() || parsed.href;
      emitGotoIfNeeded(at);

      if (ev.type === "fill" || ev.type === "change") {
        const isMasked = ev.value === "***";
        const fillVal = isMasked ? "" : ev.value ?? "";
        scriptLines.push(`await page.fill('${escapeJsString(ev.selector)}', '${escapeJsString(fillVal)}');`);
        const valueHint = isMasked
          ? "[password]"
          : fillVal.length === 0
            ? "(empty)"
            : `"${previewForStepLine(fillVal, 48)}"`;
        const kind = ev.type === "change" ? "Change" : "Enter";
        steps.push(
          `${stepNum++}. ${kind} ${valueHint} into ${ev.text || "field"} (${ev.selector})${isMasked ? " [password masked in script]" : ""}`
        );
      } else {
        scriptLines.push(`await page.click('${escapeJsString(ev.selector)}');`);
        steps.push(`${stepNum++}. Click ${ev.text || "element"} (${ev.selector})`);
      }
    }
  }

  const rawSteps = toRawSteps(events);

  const usedNames = new Set<string>();
  const locators: RecorderLocator[] = [];
  const seenSel = new Set<string>();
  for (const ev of events) {
    if (ev.type === "navigate" || !ev.selector.trim()) continue;
    if (seenSel.has(ev.selector)) continue;
    seenSel.add(ev.selector);
    locators.push({
      name: uniqueLocatorName(ev.text || ev.tag || "Control", usedNames),
      selector: ev.selector,
    });
  }

  return {
    playwrightScript: scriptLines.join("\n"),
    steps,
    locators,
    rawSteps,
  };
}

/** Blocking session for /api/generate — does not touch recordingProgress. */
export async function recordUserFlow(
  url: string,
  options?: { maxDurationMs?: number }
): Promise<RecorderResult> {
  return runRecordingSession(url, { ...options, publishProgress: false });
}

export function isRecordingSessionActive(): boolean {
  return sessionRunning;
}

/** Closes the headed browser (if any), waits for the session promise, and clears server-side recording state. */
export async function cancelRecordingSession(): Promise<void> {
  const b = recordingBrowser;
  recordingBrowser = null;
  if (b) await b.close().catch(() => undefined);
  const job = recordingJob;
  if (job) await job.catch(() => undefined);
  recordingJob = null;
  sessionRunning = false;
  recordingProgress.url = "";
  lastRecordingResult = null;
  lastRecordingError = null;
}

export function getRecordingStatus(): { active: boolean; url: string | null } {
  return {
    active: sessionRunning,
    url: recordingProgress.url ? recordingProgress.url : null,
  };
}

/**
 * Starts a background recording so the UI can poll GET /api/record/status for the live URL.
 */
export function startRecordingJob(url: string): void {
  if (sessionRunning) {
    throw new Error("A recording session is already in progress.");
  }
  lastRecordingResult = null;
  lastRecordingError = null;
  sessionRunning = true;
  recordingProgress.url = url.trim();

  recordingJob = runRecordingSession(url.trim(), { publishProgress: true })
    .then((result) => {
      lastRecordingResult = result;
      lastRecordingError = null;
    })
    .catch((e) => {
      lastRecordingResult = null;
      lastRecordingError = e instanceof Error ? e : new Error(String(e));
    })
    .finally(() => {
      sessionRunning = false;
      recordingJob = null;
    });
}

export function takeRecordingResult(): RecorderResult {
  if (sessionRunning) {
    throw new Error("RECORDING_ACTIVE");
  }
  if (lastRecordingError) {
    const e = lastRecordingError;
    lastRecordingError = null;
    throw e;
  }
  if (!lastRecordingResult) {
    throw new Error("NO_RESULT");
  }
  const r = lastRecordingResult;
  lastRecordingResult = null;
  recordingProgress.url = "";
  return r;
}

/**
 * Prefer `parsePlaywrightScriptToDsl` — returns canonical steps when parse succeeds;
 * on total parse failure, falls back to non-empty script lines so nothing is silently empty.
 */
export function parsePlaywrightToSteps(script: string): {
  steps: string[];
  locators: RecorderLocator[];
  parseErrors: string[];
} {
  const r = parsePlaywrightScriptToDsl(script);
  if (r.dsl.length > 0) {
    return { steps: r.canonicalSteps, locators: r.locators, parseErrors: r.errors };
  }
  const fallback = script
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^(import|export)\b/.test(l));
  return { steps: fallback, locators: [], parseErrors: r.errors };
}
