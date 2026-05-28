/**
 * Generates hosted tutorial WebM files for Utilities → Video Tutorials.
 * Run: npm run tutorials:videos --prefix server
 * Requires: npm run playwright:install --prefix server
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { getPlaywrightLaunchOptions } from "../src/services/playwrightLaunch.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const OUT_DIR = path.join(REPO_ROOT, "client", "public", "tutorials");
const TEMP_DIR = path.join(OUT_DIR, ".render-temp");

type TutorialSpec = {
  id: string;
  title: string;
  description: string;
  category: string;
  slides: string[];
};

/** Keep in sync with client/src/data/tutorials/videoCatalog.ts */
const TUTORIALS: TutorialSpec[] = [
  {
    id: "platform-overview",
    title: "Platform overview",
    description:
      "Tour the generator layout, API health, project upload, and where Script Generator, Gosi Brain, and Utilities live.",
    category: "Getting started",
    slides: [
      "Script Generator tabs: Functional, API, Performance, Failure Analyzer",
      "Gosi Brain: Workspace, Coverage, Refactor, Execution Report, Project tools",
      "Intelligence: Project upload, OR/keywords index, Gosi Brain Memory",
      "Utilities: Video Tutorials, Documentation, Generation History",
    ],
  },
  {
    id: "manual-generation",
    title: "Manual test generation (WebUI)",
    description: "Plain-language steps to Katalon Groovy with locators and code output modes.",
    category: "Script Generator",
    slides: [
      "One action per line: visit, click, type, use keyword",
      "Add locators or Page URL for auto-detect on Generate",
      "Set Active project to reuse Object Repository names",
      "Choose Code output and click Generate Katalon Groovy",
    ],
  },
  {
    id: "api-automation",
    title: "API Test tab",
    description: "Swagger, Postman, and cURL to Katalon API keywords and test scripts.",
    category: "Script Generator",
    slides: [
      "Paste OpenAPI, Postman JSON, or cURL snippets",
      "Review semantic folders and chained variables",
      "Export Keywords and Scripts for Katalon Studio",
      "Optional Postman collection for dual-stack QA",
    ],
  },
  {
    id: "performance-testing",
    title: "Performance Test tab",
    description: "JMeter and k6 load scripts from the same API definitions.",
    category: "Script Generator",
    slides: [
      "Reuse API input from Swagger or Postman",
      "Pick Smoke, Baseline, Stress, Spike, or Soak",
      "Download .jmx, k6 .js, or Full Suite + strategy",
      "Run locally with JMeter or k6 CLI",
    ],
  },
  {
    id: "failure-analyzer",
    title: "Gosi Brain Failure Analyzer",
    description: "Paste execution logs for root cause and fix recommendations.",
    category: "Script Generator",
    slides: [
      "Open Failure Analyzer tab on the generator",
      "Paste Katalon Studio execution log text",
      "Review classification, flakiness, and root cause",
      "Apply suggested fixes in Studio or CI",
    ],
  },
  {
    id: "ai-workspace",
    title: "Gosi Brain QA Workspace",
    description: "Chat-first QA with intent routing and project-aware agents.",
    category: "Gosi Brain",
    slides: [
      "Select Active project and memory mode in Context",
      "Attach Swagger or Postman for API questions",
      "Ask in natural language — agents route by intent",
      "Copy Groovy, reports, or follow suggestion chips",
    ],
  },
  {
    id: "coverage-analyzer",
    title: "AI Coverage Analyzer",
    description: "Coverage gaps, heatmaps, and recommendations for indexed projects.",
    category: "Gosi Brain",
    slides: [
      "Upload and index a Katalon project first",
      "Run Analyze coverage on /coverage",
      "Review module heatmap and risk score",
      "Optional OpenAPI paste for API gap analysis",
    ],
  },
  {
    id: "refactoring-assistant",
    title: "AI Refactoring Assistant",
    description: "Maintainability, duplication, and architecture recommendations.",
    category: "Gosi Brain",
    slides: [
      "Open Refactoring Assistant from Gosi Brain",
      "Run Analyze framework on indexed project",
      "Prioritize recommendations with impact scores",
      "Apply changes manually in Katalon Studio",
    ],
  },
  {
    id: "execution-report",
    title: "AI Execution Report Generator",
    description: "Release readiness and executive PDF from CI pass/fail data.",
    category: "Gosi Brain",
    slides: [
      "Enter build ID, counts, and optional failure rows",
      "Generate report for readiness and module risk",
      "Review charts and recommendations on screen",
      "Download PDF for stakeholders",
    ],
  },
  {
    id: "project-generator",
    title: "AI Katalon Project Generator",
    description: "Enterprise project scaffold with OR, keywords, and suites.",
    category: "Gosi Brain",
    slides: [
      "Set framework type, pattern, and business flows",
      "Optional source project for style reuse",
      "Analyze architecture preview",
      "Generate and download importable zip",
    ],
  },
  {
    id: "project-repair",
    title: "AI Project Repair Engine",
    description: "Safe repairs with previews and downloadable archive.",
    category: "Gosi Brain",
    slides: [
      "Analyze indexed project for flakiness and smells",
      "Preview repair diffs before applying",
      "Apply safe repairs conservatively",
      "Download repaired zip for Studio import",
    ],
  },
  {
    id: "project-intelligence",
    title: "Project Intelligence",
    description: "Upload, index, analyze, and heal your Katalon project.",
    category: "Intelligence",
    slides: [
      "Upload Katalon .zip or .rar archive",
      "Wait for OR, keyword, and script indexing",
      "Set Active project and generation mode",
      "Run Project Analyze and heal locators",
    ],
  },
  {
    id: "workspace-memory",
    title: "AI QA Workspace Memory",
    description: "Persistent flows and architecture injected into chat.",
    category: "Intelligence",
    slides: [
      "Index memory after project upload or repair",
      "Re-index after major project changes",
      "Ask about flows, locators, and risk in Workspace",
      "Review citation chips on assistant replies",
    ],
  },
  {
    id: "documentation-center",
    title: "Documentation center",
    description: "Searchable guides, workflows, and troubleshooting.",
    category: "Utilities",
    slides: [
      "Open Documentation under Utilities",
      "Search by feature or keyword",
      "Follow step workflows and tips",
      "Use Video Tutorials for visual walkthroughs",
    ],
  },
];

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
      <p class="brand">Katalon Script Generator · Gosi Brain QA</p>
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
    body {
      font-family: "Segoe UI", system-ui, sans-serif;
      background: #0c1218;
      color: #e8eaed;
      overflow: hidden;
      width: 1280px;
      height: 720px;
    }
    .deck { position: relative; width: 1280px; height: 720px; }
    .slide {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 4rem 5rem;
      opacity: 0;
      transition: opacity 0.55s ease, transform 0.55s ease;
      transform: translateY(10px);
      pointer-events: none;
    }
    .slide.active {
      opacity: 1;
      transform: translateY(0);
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #5eead4;
      background: rgba(13, 110, 110, 0.25);
      border: 1px solid rgba(13, 110, 110, 0.5);
      padding: 0.35rem 0.75rem;
      border-radius: 999px;
      margin-bottom: 1.25rem;
      width: fit-content;
    }
    h1 {
      font-size: 2.35rem;
      font-weight: 700;
      line-height: 1.15;
      margin-bottom: 1rem;
      max-width: 900px;
    }
    .desc {
      font-size: 1.2rem;
      color: #9ca3af;
      line-height: 1.5;
      max-width: 820px;
    }
    .step-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: #5eead4;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.75rem;
    }
    .step-text {
      font-size: 1.85rem;
      font-weight: 600;
      line-height: 1.35;
      max-width: 900px;
    }
    .brand {
      position: absolute;
      bottom: 2rem;
      left: 5rem;
      font-size: 0.8rem;
      color: #6b7280;
    }
    .progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 4px;
      width: 0;
      background: linear-gradient(90deg, #0d6e6e, #5eead4);
      transition: width 0.4s linear;
      z-index: 2;
    }
    .outro-title { font-size: 1.75rem; margin-bottom: 0.5rem; font-weight: 700; }
    .outro-sub { color: #9ca3af; font-size: 1.1rem; max-width: 700px; line-height: 1.45; }
  </style>
</head>
<body>
  <div class="deck">
    <div class="progress" id="progress"></div>
    <section class="slide" data-ms="${INTRO_MS}">
      <span class="badge">${escapeHtml(t.category)}</span>
      <h1>${escapeHtml(t.title)}</h1>
      <p class="desc">${escapeHtml(t.description)}</p>
      <p class="brand">Katalon Script Generator · Gosi Brain QA</p>
    </section>
    ${stepSlides}
    <section class="slide" data-ms="${OUTRO_MS}">
      <span class="badge">Next step</span>
      <p class="outro-title">Try it in the app</p>
      <p class="outro-sub">Open the feature from the sidebar and follow the written guide in Documentation.</p>
      <p class="brand">Utilities → Video Tutorials</p>
    </section>
  </div>
  <script>
    const slides = Array.from(document.querySelectorAll(".slide"));
    const progress = document.getElementById("progress");
    let index = 0;
    function showSlide() {
      slides.forEach((s, i) => s.classList.toggle("active", i === index));
      if (progress) progress.style.width = ((index + 1) / slides.length * 100) + "%";
      const ms = Number(slides[index]?.dataset.ms || ${SLIDE_MS});
      index += 1;
      if (index < slides.length) setTimeout(showSlide, ms);
    }
    setTimeout(showSlide, 400);
    window.__TOTAL_MS__ = ${totalMs};
  </script>
</body>
</html>`;
}

function recordingDurationMs(t: TutorialSpec): number {
  return INTRO_MS + t.slides.length * SLIDE_MS + OUTRO_MS + 1500;
}

async function recordTutorial(t: TutorialSpec): Promise<string> {
  const html = buildTutorialHtml(t);
  const htmlPath = path.join(TEMP_DIR, `${t.id}.html`);
  await writeFile(htmlPath, html, "utf8");

  const browser = await chromium.launch(getPlaywrightLaunchOptions());
  const outPath = path.join(OUT_DIR, `${t.id}.webm`);

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      recordVideo: {
        dir: TEMP_DIR,
        size: { width: 1280, height: 720 },
      },
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

async function main() {
  const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7);
  const list = only ? TUTORIALS.filter((t) => t.id === only) : TUTORIALS;
  if (only && list.length === 0) {
    console.error(`Unknown tutorial id: ${only}`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(TEMP_DIR, { recursive: true });

  console.log(`Generating ${list.length} tutorial video(s) → ${OUT_DIR}`);

  for (const t of list) {
    process.stdout.write(`  · ${t.id} … `);
    try {
      const out = await recordTutorial(t);
      console.log(`OK (${out})`);
    } catch (e) {
      console.log("FAILED");
      console.error(e);
      process.exitCode = 1;
    }
  }

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
