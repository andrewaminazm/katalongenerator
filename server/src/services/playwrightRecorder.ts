import { existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright";

const __recDir = path.dirname(fileURLToPath(import.meta.url));

export interface RecorderLocator {
  name: string;
  selector: string;
}

export interface RecorderResult {
  playwrightScript: string;
  steps: string[];
  locators: RecorderLocator[];
}

export interface RecorderEventPayload {
  type: "click" | "fill";
  selector: string;
  tag?: string;
  text?: string;
  value?: string;
  /** Set server-side when the event is received — used to emit correct `page.goto` after in-session navigation. */
  pageUrl?: string;
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
const MAX_EVENTS = 200;

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

/** Compare URLs for deduping consecutive navigations (strip hash only). */
function navKey(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    return x.href;
  } catch {
    return u;
  }
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

  const events: RecorderEventPayload[] = []; // pageUrl filled in __pwRecorderEvent handler
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
      if (events.length >= MAX_EVENTS) return;
      if (!payload || typeof payload.selector !== "string" || !payload.selector.trim()) return;
      let pageUrl = "";
      try {
        pageUrl = page.url();
      } catch {
        pageUrl = parsed.href;
      }
      events.push({
        type: payload.type === "fill" ? "fill" : "click",
        selector: payload.selector.trim(),
        tag: payload.tag,
        text: payload.text,
        value: payload.value,
        pageUrl,
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
      const at = ev.pageUrl?.trim() || parsed.href;
      emitGotoIfNeeded(at);
      if (ev.type === "fill") {
        const isMasked = ev.value === "***";
        const fillVal = isMasked ? "" : ev.value ?? "";
        scriptLines.push(`await page.fill('${escapeJsString(ev.selector)}', '${escapeJsString(fillVal)}');`);
        const valueHint = isMasked
          ? "[password]"
          : fillVal.length === 0
            ? "(empty)"
            : `"${previewForStepLine(fillVal, 48)}"`;
        steps.push(
          `${stepNum++}. Enter ${valueHint} into ${ev.text || "field"} (${ev.selector})${isMasked ? " [password masked in script]" : ""}`
        );
      } else {
        scriptLines.push(`await page.click('${escapeJsString(ev.selector)}');`);
        steps.push(`${stepNum++}. Click ${ev.text || "element"} (${ev.selector})`);
      }
    }
  }

  const usedNames = new Set<string>();
  const locators: RecorderLocator[] = [];
  const seenSel = new Set<string>();
  for (const ev of events) {
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

export function parsePlaywrightToSteps(script: string): {
  steps: string[];
  locators: RecorderLocator[];
} {
  const steps: string[] = [];
  const locators: RecorderLocator[] = [];
  const seenSel = new Set<string>();
  const usedNames = new Set<string>();
  let stepNum = 1;

  const pushLocator = (selector: string, hint: string) => {
    if (seenSel.has(selector)) return;
    seenSel.add(selector);
    locators.push({
      name: uniqueLocatorName(hint, usedNames),
      selector,
    });
  };

  for (const raw of script.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    const goto = line.match(/await\s+page\.goto\(\s*['"]([^'"]+)['"]\s*\)/);
    if (goto) {
      steps.push(`${stepNum++}. Navigate to ${goto[1]}`);
      continue;
    }

    const fill = line.match(
      /await\s+page\.fill\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]\s*\)/
    );
    if (fill) {
      const sel = fill[1];
      steps.push(`${stepNum++}. Enter text into field (${sel})`);
      pushLocator(sel, "Field");
      continue;
    }

    const click = line.match(/await\s+page\.click\(\s*['"]([^'"]+)['"]\s*\)/);
    if (click) {
      const sel = click[1];
      steps.push(`${stepNum++}. Click element (${sel})`);
      pushLocator(sel, "Button");
    }
  }

  return { steps, locators };
}
