import { execSync, spawn, type ChildProcess } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Locator, Page } from "playwright";
import { chromium } from "playwright";
import { getPlaywrightLaunchOptions } from "../src/services/playwrightLaunch.js";
import type { TutorialSpec } from "./tutorialCatalog.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");

const ONBOARDING_KEY = "katalon:onboarding_complete";
const STEP_OVERLAY_ID = "katalon-tutorial-step";
const TITLE_OVERLAY_ID = "katalon-tutorial-title";
const REVIEW_OVERLAY_ID = "katalon-tutorial-review";

/** Target length shown in the UI (~45 sec). */
export const TARGET_VIDEO_SEC = 45;
const STEP_PAUSE_MS = 4800;
const TITLE_HOLD_MS = 2600;
const POST_CLICK_MS = 2200;
const REVIEW_ACTION_MS = 4000;
const MAX_VIDEO_SEC = 52;

export async function waitForHttp(url: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status < 500) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`App not reachable at ${url}`);
}

export function buildClient(): void {
  console.log("Building client for preview…");
  execSync("npm run build --prefix client", { cwd: REPO_ROOT, stdio: "inherit" });
}

function spawnQuiet(cmd: string, args: string[], cwd: string): ChildProcess {
  return spawn(cmd, args, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"] });
}

/** Vite dev server (proxies /api → backend). */
export async function startViteDev(port = 5173): Promise<() => void> {
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawnQuiet("npx", ["vite", "--port", String(port), "--host", "127.0.0.1"], path.join(REPO_ROOT, "client"));
  await waitForHttp(baseUrl);
  return () => child.kill("SIGTERM");
}

export async function startApiServer(port = 8787): Promise<() => void> {
  const healthUrl = `http://127.0.0.1:${port}/api/health`;
  const child = spawnQuiet("npm", ["run", "dev"], path.join(REPO_ROOT, "server"));
  await waitForHttp(healthUrl, 90_000);
  return () => child.kill("SIGTERM");
}

export async function startVitePreview(port = 4173): Promise<() => void> {
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawnQuiet(
    "npx",
    ["vite", "preview", "--port", String(port), "--host", "127.0.0.1"],
    path.join(REPO_ROOT, "client")
  );
  await waitForHttp(baseUrl);
  return () => child.kill("SIGTERM");
}

/** Start API + Vite dev when nothing is running (full interactive demos). */
export async function ensureDevStack(): Promise<{ baseUrl: string; cleanup: () => void }> {
  try {
    await waitForHttp("http://127.0.0.1:5173", 4_000);
    await waitForHttp("http://127.0.0.1:8787/api/health", 4_000);
    console.log("Using existing dev stack at http://127.0.0.1:5173");
    return { baseUrl: "http://127.0.0.1:5173", cleanup: () => undefined };
  } catch {
    /* start fresh */
  }

  console.log("Starting API server + Vite dev for interactive demos…");
  const stopApi = await startApiServer();
  const stopClient = await startViteDev();
  return {
    baseUrl: "http://127.0.0.1:5173",
    cleanup: () => {
      stopClient();
      stopApi();
    },
  };
}

async function dismissOnboarding(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    localStorage.setItem(key, "1");
  }, ONBOARDING_KEY);

  const backdrop = page.locator(".onboarding-backdrop");
  if (await backdrop.isVisible().catch(() => false)) {
    await page
      .getByRole("button", { name: /skip|close|got it|done|finish|next/i })
      .first()
      .click({ timeout: 3000, force: true })
      .catch(() => backdrop.click({ position: { x: 8, y: 8 }, force: true }));
    await page.waitForTimeout(400);
  }
}

async function gotoApp(page: Page, baseUrl: string, route: string): Promise<void> {
  await page.goto(new URL(route, baseUrl).href, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await dismissOnboarding(page);
  await page.waitForTimeout(900);
}

async function showTitle(page: Page, title: string): Promise<void> {
  await page.evaluate(
    ({ title: t, id }) => {
      document.getElementById(id)?.remove();
      const el = document.createElement("div");
      el.id = id;
      el.textContent = t;
      Object.assign(el.style, {
        position: "fixed",
        top: "10px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        padding: "8px 18px",
        background: "rgba(10, 16, 22, 0.94)",
        color: "#5eead4",
        borderRadius: "8px",
        border: "1px solid rgba(13, 110, 110, 0.55)",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: "13px",
        fontWeight: "700",
        pointerEvents: "none",
      });
      document.body.appendChild(el);
    },
    { title, id: TITLE_OVERLAY_ID }
  );
}

async function showStep(page: Page, step: number, total: number, text: string): Promise<void> {
  await page.evaluate(
    ({ step: s, total: t, text: txt, id }) => {
      let el = document.getElementById(id);
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        document.body.appendChild(el);
      }
      el.textContent = `Step ${s}/${t}: ${txt}`;
      Object.assign(el.style, {
        position: "fixed",
        bottom: "18px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        padding: "11px 20px",
        background: "rgba(13, 110, 110, 0.96)",
        color: "#fff",
        borderRadius: "10px",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: "14px",
        fontWeight: "600",
        maxWidth: "min(92vw, 720px)",
        textAlign: "center",
        boxShadow: "0 6px 28px rgba(0,0,0,0.45)",
        pointerEvents: "none",
      });
    },
    { step, total, text, id: STEP_OVERLAY_ID }
  );
  await page.waitForTimeout(STEP_PAUSE_MS);
}

async function highlight(page: Page, target: Locator): Promise<void> {
  await target.first().scrollIntoViewIfNeeded().catch(() => undefined);
  await target
    .first()
    .evaluate((el) => {
      el.setAttribute("data-tutorial-highlight", "1");
      (el as HTMLElement).style.outline = "3px solid #5eead4";
      (el as HTMLElement).style.outlineOffset = "3px";
      (el as HTMLElement).style.boxShadow = "0 0 0 8px rgba(13, 110, 110, 0.35)";
    })
    .catch(() => undefined);
  await page.waitForTimeout(700);
}

async function unhighlight(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelectorAll("[data-tutorial-highlight]").forEach((el) => {
      (el as HTMLElement).style.outline = "";
      (el as HTMLElement).style.outlineOffset = "";
      (el as HTMLElement).style.boxShadow = "";
      el.removeAttribute("data-tutorial-highlight");
    });
  });
}

type DemoStep = { label: string; action: () => Promise<void> };

async function runDemoSteps(page: Page, steps: DemoStep[]): Promise<void> {
  const total = steps.length;
  for (let i = 0; i < total; i++) {
    await showStep(page, i + 1, total, steps[i].label);
    await steps[i].action();
    await unhighlight(page);
  }
}

async function finishFeatureDemo(page: Page, demoStart: number, steps: DemoStep[]): Promise<void> {
  await runDemoSteps(page, [
    ...steps,
    {
      label: "Review results on screen",
      action: async () => {
        await page.waitForTimeout(REVIEW_ACTION_MS);
      },
    },
  ]);
  await padToTargetDuration(page, demoStart);
}

async function padToTargetDuration(page: Page, demoStart: number): Promise<void> {
  const targetMs = TARGET_VIDEO_SEC * 1000;
  const maxMs = MAX_VIDEO_SEC * 1000;
  const elapsed = Date.now() - demoStart;
  const remaining = Math.min(targetMs - elapsed, maxMs - elapsed);
  if (remaining < 1200) return;

  await page.evaluate(
    ({ id }) => {
      document.getElementById(id)?.remove();
      const el = document.createElement("div");
      el.id = id;
      el.textContent = "Review the results on screen";
      Object.assign(el.style, {
        position: "fixed",
        bottom: "18px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        padding: "11px 20px",
        background: "rgba(13, 110, 110, 0.96)",
        color: "#fff",
        borderRadius: "10px",
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: "14px",
        fontWeight: "600",
        pointerEvents: "none",
      });
      document.body.appendChild(el);
    },
    { id: REVIEW_OVERLAY_ID }
  );
  await page.waitForTimeout(remaining);
  await page.evaluate((id) => document.getElementById(id)?.remove(), REVIEW_OVERLAY_ID);
}

async function clickBtn(page: Page, name: RegExp | string): Promise<void> {
  const btn = page.getByRole("button", { name });
  await highlight(page, btn);
  await btn
    .first()
    .click({ timeout: 4000, force: true, noWaitAfter: true })
    .catch(() => undefined);
  await page.waitForTimeout(POST_CLICK_MS);
}

/** Highlight only — avoids blocking on long API jobs (zip generation, re-index). */
async function showBtn(page: Page, name: RegExp | string): Promise<void> {
  const btn = page.getByRole("button", { name });
  await highlight(page, btn);
  await page.waitForTimeout(POST_CLICK_MS);
}

async function fillField(page: Page, locator: Locator, value: string): Promise<void> {
  await highlight(page, locator);
  await locator.first().click({ force: true }).catch(() => undefined);
  await locator.first().fill(value).catch(() => undefined);
  await page.waitForTimeout(800);
}

/** Interactive walkthrough per feature — real clicks, inputs, and labeled steps. */
async function runFeatureDemo(page: Page, baseUrl: string, t: TutorialSpec): Promise<void> {
  const demoStart = Date.now();
  await showTitle(page, t.title);
  await page.waitForTimeout(TITLE_HOLD_MS);

  switch (t.id) {
    case "platform-overview": {
      await gotoApp(page, baseUrl, "/?tab=manual");
      await finishFeatureDemo(page, demoStart, [
        { label: "Functional Test — write steps in plain English", action: async () => {
          await fillField(page, page.locator("textarea").first(), "visit https://example.com\nclick Login");
        }},
        { label: "Switch to API Test tab", action: async () => {
          await clickBtn(page, "API Test");
        }},
        { label: "Open Gosi Brain QA Workspace", action: async () => {
          await clickBtn(page, "QA Workspace");
        }},
        { label: "Open Video Tutorials in Utilities", action: async () => {
          await clickBtn(page, "Video Tutorials");
        }},
      ]);
      break;
    }

    case "manual-generation": {
      await gotoApp(page, baseUrl, "/?tab=manual");
      await finishFeatureDemo(page, demoStart, [
        { label: "Enter test steps (one action per line)", action: async () => {
          await fillField(
            page,
            page.locator("textarea").first(),
            "visit https://example.com/login\nclick btn_Login\ntype input_User admin"
          );
        }},
        { label: "Choose code output mode", action: async () => {
          const sel = page.locator("select").filter({ has: page.locator('option[value="auto"]') }).first();
          if (await sel.count()) {
            await highlight(page, sel);
            await sel.selectOption("auto").catch(() => undefined);
          }
        }},
        { label: "Click Generate Katalon Groovy", action: async () => {
          await clickBtn(page, /Generate Katalon Groovy/i);
        }},
      ]);
      break;
    }

    case "api-automation": {
      await gotoApp(page, baseUrl, "/?tab=api");
      await finishFeatureDemo(page, demoStart, [
        { label: "Open API Test tab", action: async () => {} },
        { label: "Paste Swagger / OpenAPI spec", action: async () => {
          const ta = page.locator("textarea").first();
          await fillField(
            page,
            ta,
            'openapi: "3.0.0"\ninfo:\n  title: Demo API\npaths:\n  /login:\n    post:\n      summary: Login'
          );
        }},
        { label: "Generate Katalon API keywords & scripts", action: async () => {
          await clickBtn(page, /Generate Katalon code/i);
        }},
      ]);
      break;
    }

    case "performance-testing": {
      await gotoApp(page, baseUrl, "/?tab=performance");
      await finishFeatureDemo(page, demoStart, [
        { label: "Open Performance Test tab", action: async () => {} },
        { label: "Select load mode (Smoke, Stress, Spike…)", action: async () => {
          const sel = page.locator("select").first();
          await highlight(page, sel);
          await sel.selectOption({ index: 1 }).catch(() => undefined);
        }},
        { label: "Generate JMeter load script", action: async () => {
          await clickBtn(page, /Generate JMeter/i);
        }},
      ]);
      break;
    }

    case "failure-analyzer": {
      await gotoApp(page, baseUrl, "/?tab=failure");
      await finishFeatureDemo(page, demoStart, [
        { label: "Paste Katalon execution log", action: async () => {
          await fillField(
            page,
            page.locator("textarea").first(),
            "Test Cases/LoginTest FAILED\nElement not found: btn_Login\n at com.kms.katalon.core..."
          );
        }},
        { label: "Click Analyze failure", action: async () => {
          await clickBtn(page, /Analyze failure/i);
        }},
        { label: "Review root cause & fix recommendations", action: async () => {
          await page.waitForTimeout(POST_CLICK_MS);
        }},
      ]);
      break;
    }

    case "ai-workspace": {
      await gotoApp(page, baseUrl, "/ai-workspace");
      await finishFeatureDemo(page, demoStart, [
        { label: "Set project context (optional)", action: async () => {
          const sel = page.locator("select").first();
          if (await sel.count()) await highlight(page, sel);
        }},
        { label: "Ask in natural language", action: async () => {
          await fillField(
            page,
            page.locator("textarea").first(),
            "Generate login API tests with negative scenarios from my Swagger"
          );
        }},
        { label: "Send to Gosi Brain agents", action: async () => {
          await clickBtn(page, /^Send$/i);
        }},
      ]);
      break;
    }

    case "coverage-analyzer": {
      await gotoApp(page, baseUrl, "/coverage");
      await finishFeatureDemo(page, demoStart, [
        { label: "Select indexed Katalon project", action: async () => {
          const sel = page.locator("select").first();
          await highlight(page, sel);
          const opts = await sel.locator("option").all();
          if (opts.length > 1) await sel.selectOption({ index: 1 }).catch(() => undefined);
        }},
        { label: "Optional: paste OpenAPI for API gaps", action: async () => {
          const ta = page.locator("textarea").first();
          await fillField(page, ta, "openapi: 3.0.0\ninfo:\n  title: Demo");
        }},
        { label: "Run Analyze coverage", action: async () => {
          await clickBtn(page, /Analyze coverage/i);
        }},
      ]);
      break;
    }

    case "refactoring-assistant": {
      await gotoApp(page, baseUrl, "/refactor");
      await finishFeatureDemo(page, demoStart, [
        { label: "Select project to inspect", action: async () => {
          const sel = page.locator("select").first();
          await highlight(page, sel);
          if ((await sel.locator("option").count()) > 1) await sel.selectOption({ index: 1 }).catch(() => undefined);
        }},
        { label: "Run Analyze framework", action: async () => {
          await clickBtn(page, /Analyze framework/i);
        }},
        { label: "Review maintainability & recommendations", action: async () => {
          await page.waitForTimeout(POST_CLICK_MS);
        }},
      ]);
      break;
    }

    case "execution-report": {
      await gotoApp(page, baseUrl, "/execution-report");
      await finishFeatureDemo(page, demoStart, [
        { label: "Load sample execution data", action: async () => {
          await clickBtn(page, /Load sample/i);
        }},
        { label: "Generate release readiness report", action: async () => {
          await clickBtn(page, /Generate report/i);
        }},
        { label: "Review pass rate, risk & module scores", action: async () => {
          await page.waitForTimeout(POST_CLICK_MS);
        }},
      ]);
      break;
    }

    case "project-generator": {
      await gotoApp(page, baseUrl, "/project-generator");
      await finishFeatureDemo(page, demoStart, [
        { label: "Enter project name & framework type", action: async () => {
          const name = page.locator('input[type="text"]').first();
          await fillField(page, name, "Enterprise Demo Suite");
        }},
        { label: "Analyze architecture preview", action: async () => {
          await clickBtn(page, /^Analyze$/i);
        }},
        { label: "Generate downloadable Katalon project zip", action: async () => {
          await showBtn(page, /Generate project/i);
        }},
      ]);
      break;
    }

    case "project-repair": {
      await gotoApp(page, baseUrl, "/project-repair");
      await finishFeatureDemo(page, demoStart, [
        { label: "Select project to repair", action: async () => {
          const sel = page.locator("select").first();
          await highlight(page, sel);
          if ((await sel.locator("option").count()) > 1) await sel.selectOption({ index: 1 }).catch(() => undefined);
        }},
        { label: "Analyze project health & flaky scripts", action: async () => {
          await clickBtn(page, /Analyze project/i);
        }},
        { label: "Preview safe repair diffs", action: async () => {
          await showBtn(page, /Preview repairs/i);
        }},
      ]);
      break;
    }

    case "project-intelligence": {
      await gotoApp(page, baseUrl, "/#project-intelligence");
      await finishFeatureDemo(page, demoStart, [
        { label: "Upload Katalon .zip / .rar archive", action: async () => {
          const upload = page.locator('input[type="file"]').first();
          await highlight(page, upload);
        }},
        { label: "Set Active project & generation mode", action: async () => {
          const sel = page.locator("select").first();
          if (await sel.count()) await highlight(page, sel);
        }},
        { label: "Run Project Analyze for full report", action: async () => {
          await clickBtn(page, /Project Analyze/i);
        }},
      ]);
      break;
    }

    case "workspace-memory": {
      await gotoApp(page, baseUrl, "/ai-workspace");
      await finishFeatureDemo(page, demoStart, [
        { label: "Open QA Workspace with project context", action: async () => {} },
        { label: "Enable enterprise workspace memory", action: async () => {
          const toggle = page.getByText(/workspace memory|enterprise memory/i).first();
          if (await toggle.isVisible().catch(() => false)) await highlight(page, toggle);
        }},
        { label: "Re-index memory after project changes", action: async () => {
          await showBtn(page, /Re-index memory/i);
        }},
      ]);
      break;
    }

    case "documentation-center": {
      await gotoApp(page, baseUrl, "/how-to-use");
      await finishFeatureDemo(page, demoStart, [
        { label: "Search documentation by keyword", action: async () => {
          const search = page.locator('input[type="search"], #htu-doc-search').first();
          await fillField(page, search, "API Test");
        }},
        { label: "Browse a guide section", action: async () => {
          await page.getByRole("button", { name: /Manual Test|API Automation/i }).first().click({ force: true }).catch(() => undefined);
        }},
        { label: "Follow step-by-step workflow", action: async () => {
          await page.waitForTimeout(POST_CLICK_MS);
        }},
      ]);
      break;
    }

    default:
      await gotoApp(page, baseUrl, t.path);
      await finishFeatureDemo(
        page,
        demoStart,
        t.slides.slice(0, 3).map((label) => ({ label, action: async () => {} }))
      );
  }

  await page.evaluate(
    ({ stepId, titleId }) => {
      document.getElementById(stepId)?.remove();
      document.getElementById(titleId)?.remove();
    },
    { stepId: STEP_OVERLAY_ID, titleId: TITLE_OVERLAY_ID }
  );
  await page.evaluate((id) => document.getElementById(id)?.remove(), REVIEW_OVERLAY_ID);
  await page.waitForTimeout(400);
}

export async function recordAppTutorial(
  baseUrl: string,
  t: TutorialSpec,
  outPath: string,
  tempVideoDir: string
): Promise<void> {
  const perVideoDir = path.join(tempVideoDir, t.id);
  await rm(perVideoDir, { recursive: true, force: true });
  await mkdir(perVideoDir, { recursive: true });

  const browser = await chromium.launch(getPlaywrightLaunchOptions());
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: { dir: perVideoDir, size: { width: 1280, height: 720 } },
    });
    const page = await context.newPage();
    await runFeatureDemo(page, baseUrl, t);
    const video = page.video();
    await context.close();
    if (!video) throw new Error(`No video captured for ${t.id}`);
    await video.saveAs(outPath);
  } finally {
    await browser.close();
  }
}
