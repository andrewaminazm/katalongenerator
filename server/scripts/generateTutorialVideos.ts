/**
 * Generates tutorial WebM files for Utilities → Video Tutorials.
 *
 * Default: real UI screen capture (Playwright records the live app).
 *   npm run tutorials:videos --prefix server
 *   Uses TUTORIAL_BASE_URL or starts vite preview after building client.
 *
 * Slides-only (text animations, no app UI):
 *   npm run tutorials:videos --prefix server -- --mode=slides
 */
import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { getPlaywrightLaunchOptions } from "../src/services/playwrightLaunch.js";
import { TUTORIALS, type TutorialSpec } from "./tutorialCatalog.js";
import {
  buildClient,
  ensureDevStack,
  recordAppTutorial,
  startVitePreview,
  waitForHttp,
} from "./tutorialAppCapture.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(REPO_ROOT, "client", "public", "tutorials");
const TEMP_DIR = path.join(OUT_DIR, ".render-temp");
const DURATIONS_JSON = path.join(REPO_ROOT, "client", "src", "data", "tutorials", "tutorialDurations.json");

function probeVideoDurationSec(filePath: string): number {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath.replace(/"/g, '\\"')}"`,
      { encoding: "utf8" }
    );
    const sec = Math.round(parseFloat(out.trim()));
    return Number.isFinite(sec) && sec > 0 ? sec : 0;
  } catch {
    return 0;
  }
}

async function syncDurationManifest(ids: string[]): Promise<void> {
  let existing: Record<string, number> = {};
  try {
    existing = JSON.parse(await readFile(DURATIONS_JSON, "utf8")) as Record<string, number>;
  } catch {
    /* new file */
  }
  for (const id of ids) {
    const file = path.join(OUT_DIR, `${id}.webm`);
    const sec = probeVideoDurationSec(file);
    if (sec > 0) existing[id] = sec;
  }
  await writeFile(DURATIONS_JSON, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
  console.log(`Updated duration labels → ${DURATIONS_JSON}`);
}

const SLIDE_MS = 4200;
const INTRO_MS = 5000;
const OUTRO_MS = 4500;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildTutorialHtml(t: TutorialSpec): string {
  const stepSlides = t.slides
    .map(
      (text, i) => `
    <section class="slide" data-ms="${SLIDE_MS}">
      <p class="step-label">Step ${i + 1}</p>
      <p class="step-text">${escapeHtml(text)}</p>
    </section>`
    )
    .join("");

  const totalMs = INTRO_MS + t.slides.length * SLIDE_MS + OUTRO_MS + 800;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(t.title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0c1218; color: #e8eaed; width: 1280px; height: 720px; overflow: hidden; }
    .slide { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; padding: 4rem 5rem; opacity: 0; transition: opacity 0.55s ease; }
    .slide.active { opacity: 1; }
    h1 { font-size: 2.35rem; margin-bottom: 1rem; }
    .desc { font-size: 1.2rem; color: #9ca3af; }
  </style>
</head>
<body>
  <section class="slide" data-ms="${INTRO_MS}"><h1>${escapeHtml(t.title)}</h1><p class="desc">${escapeHtml(t.description)}</p></section>
  ${stepSlides}
  <script>
    const slides = Array.from(document.querySelectorAll(".slide"));
    let i = 0;
    function next() {
      slides.forEach((s, j) => s.classList.toggle("active", j === i));
      const ms = Number(slides[i]?.dataset.ms || ${SLIDE_MS});
      i++;
      if (i < slides.length) setTimeout(next, ms);
    }
    setTimeout(next, 400);
  </script>
</body>
</html>`;
}

function recordingDurationMs(t: TutorialSpec): number {
  return INTRO_MS + t.slides.length * SLIDE_MS + OUTRO_MS + 1500;
}

async function recordSlideTutorial(t: TutorialSpec): Promise<string> {
  const html = buildTutorialHtml(t);
  const htmlPath = path.join(TEMP_DIR, `${t.id}.html`);
  await writeFile(htmlPath, html, "utf8");

  const browser = await chromium.launch(getPlaywrightLaunchOptions());
  const outPath = path.join(OUT_DIR, `${t.id}.webm`);

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: TEMP_DIR, size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "load" });
    await page.waitForTimeout(recordingDurationMs(t));
    const video = page.video();
    await context.close();
    if (!video) throw new Error(`No video recorded for ${t.id}`);
    await video.saveAs(outPath);
    return outPath;
  } finally {
    await browser.close();
  }
}

function parseMode(): "app" | "slides" {
  const flag = process.argv.find((a) => a.startsWith("--mode="))?.slice(7);
  return flag === "slides" ? "slides" : "app";
}

async function resolveBaseUrl(): Promise<{ baseUrl: string; cleanup: () => void }> {
  const envUrl = process.env.TUTORIAL_BASE_URL?.trim()?.replace(/\/$/, "");
  if (envUrl) {
    await waitForHttp(envUrl);
    console.log(`Using app at ${envUrl}`);
    return { baseUrl: envUrl, cleanup: () => undefined };
  }

  try {
    await waitForHttp("http://127.0.0.1:5173", 5_000);
    await waitForHttp("http://127.0.0.1:8787/api/health", 5_000);
    console.log("Using existing dev stack at http://127.0.0.1:5173");
    return { baseUrl: "http://127.0.0.1:5173", cleanup: () => undefined };
  } catch {
    /* start stack */
  }

  if (process.argv.includes("--preview")) {
    buildClient();
    const stop = await startVitePreview();
    console.log("Using vite preview at http://127.0.0.1:4173 (API actions may be limited)");
    return { baseUrl: "http://127.0.0.1:4173", cleanup: stop };
  }

  return ensureDevStack();
}

async function main() {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

  if (process.argv.includes("--sync-durations")) {
    const ids = only ? TUTORIALS.filter((t) => t.id === only).map((t) => t.id) : TUTORIALS.map((t) => t.id);
    if (only && ids.length === 0) {
      console.error(`Unknown tutorial id: ${only}`);
      process.exit(1);
    }
    await mkdir(OUT_DIR, { recursive: true });
    await syncDurationManifest(ids);
    console.log("Done.");
    return;
  }

  const mode = parseMode();
  const list = only ? TUTORIALS.filter((t) => t.id === only) : TUTORIALS;
  if (only && list.length === 0) {
    console.error(`Unknown tutorial id: ${only}`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  let cleanup: () => void = () => undefined;
  let baseUrl = "";

  if (mode === "app") {
    const resolved = await resolveBaseUrl();
    baseUrl = resolved.baseUrl;
    cleanup = resolved.cleanup;
    console.log(`UI capture mode — recording from ${baseUrl}`);
  } else {
    console.log("Slides mode — animated text only (no app screenshots)");
  }

  console.log(`Generating ${list.length} tutorial video(s) → ${OUT_DIR}`);

  const generatedIds: string[] = [];

  try {
    for (const t of list) {
      process.stdout.write(`  · ${t.id} … `);
      try {
        const outPath = path.join(OUT_DIR, `${t.id}.webm`);
        if (mode === "app") {
          await recordAppTutorial(baseUrl, t, outPath, TEMP_DIR);
        } else {
          await recordSlideTutorial(t);
        }
        console.log(`OK (${outPath})`);
        generatedIds.push(t.id);
      } catch (e) {
        console.log("FAILED");
        console.error(e);
        process.exitCode = 1;
      }
    }
  } finally {
    cleanup();
  }

  if (generatedIds.length > 0) {
    await syncDurationManifest(generatedIds);
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
