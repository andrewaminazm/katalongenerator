/**
 * Build Playwright-style locator lines (getByRole, getByLabel, …) for a URL.
 * Used by POST /api/locators-playwright and the CLI script.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium, type Page } from "playwright";
import {
  type PlaywrightLocaleMode,
  resolvePlaywrightLocale,
} from "./playwrightLocale.js";

const __dir = dirname(fileURLToPath(import.meta.url));

let cachedCollectorJs: string | null = null;

function getCollectorSource(): string {
  if (cachedCollectorJs) return cachedCollectorJs;
  const p = join(__dir, "collectPlaywrightRaw.inbrowser.js");
  cachedCollectorJs = readFileSync(p, "utf8").trim();
  return cachedCollectorJs;
}

const NAV_TIMEOUT = 30_000;
const SCROLL_PAUSE_MS = 400;

function j(s: string): string {
  return JSON.stringify(s);
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isLikelyDynamicId(id: string): boolean {
  const t = id.trim();
  if (!t) return true;
  if (/^[a-f0-9-]{32,}$/i.test(t)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t)) return true;
  if (/^react-|^ember\d+/i.test(t)) return true;
  if (/[:/[\]$]/.test(t)) return true;
  return false;
}

export type PlaywrightRawItem = {
  tag: string;
  type: string;
  id: string | null;
  testId: string | null;
  nameAttr: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  title: string | null;
  alt?: string | null;
  src?: string | null;
  className?: string | null;
  backgroundImage?: string | null;
  text: string;
  labelText: string | null;
  roleAttr: string | null;
  headingLevel: number | null;
};

async function collectRaw(page: Page): Promise<PlaywrightRawItem[]> {
  return page.evaluate(getCollectorSource());
}

function visibleName(d: PlaywrightRawItem): string {
  return normalize(
    d.ariaLabel || d.labelText || d.text || d.placeholder || d.title || d.nameAttr || ""
  );
}

function humanLabel(d: PlaywrightRawItem, index: number): string {
  const vn = visibleName(d);
  if (vn.length > 0 && vn.length <= 80) return vn;
  if (d.id && !isLikelyDynamicId(d.id)) return d.id;
  if (d.testId) return d.testId;
  if (d.placeholder) return d.placeholder.slice(0, 60);
  return `${d.tag}_${index + 1}`;
}

function buildPlaywrightLocator(d: PlaywrightRawItem): string | null {
  const vn = visibleName(d);
  const tag = d.tag;
  const type = d.type;

  // Branding elements: images / icons / logos
  if (tag === "img" || d.roleAttr === "img") {
    const alt = normalize(d.alt ?? "") || "";
    if (alt.length >= 2 && alt.length <= 160) {
      return `page.locator(${j(`img[alt=\"${alt.replace(/\"/g, "\\\"")}\"]`)})`;
    }
    if (d.ariaLabel && d.ariaLabel.length >= 2 && d.ariaLabel.length <= 160) {
      return `page.getByRole('img', { name: ${j(d.ariaLabel)}, exact: true })`;
    }
    if (d.title && d.title.length >= 2 && d.title.length <= 160) {
      return `page.locator(${j(`img[title=\"${d.title.replace(/\"/g, "\\\"")}\"]`)})`;
    }
    if (d.id && !isLikelyDynamicId(d.id)) {
      return `page.locator(${j("#" + d.id)})`;
    }
    if (d.testId) {
      return `page.getByTestId(${j(d.testId)})`;
    }
    if (d.src && d.src.length >= 4) {
      const base = d.src.split("?")[0];
      const part = base.split("/").pop() || base;
      const key = part.replace(/\.(png|jpg|jpeg|gif|webp|svg)$/i, "").slice(0, 60);
      if (key.length >= 3) {
        return `page.locator(${j(`img[src*=\"${key.replace(/\"/g, "\\\"")}\"]`)})`;
      }
    }
  }

  if (tag === "svg") {
    if (d.ariaLabel && d.ariaLabel.length >= 2 && d.ariaLabel.length <= 160) {
      return `page.locator(${j(`svg[aria-label=\"${d.ariaLabel.replace(/\"/g, "\\\"")}\"]`)})`;
    }
    if (d.className) {
      const tok = d.className.split(/\s+/)[0];
      if (tok && tok.length >= 2 && tok.length <= 48) {
        return `page.locator(${j(`svg.${tok}`)})`;
      }
    }
  }

  if (d.backgroundImage) {
    const styleHint = "background-image";
    return `page.locator(${j(`[style*=\"${styleHint}\"]`)})`;
  }

  if ((tag === "input" || tag === "select" || tag === "textarea") && d.labelText) {
    return `page.getByLabel(${j(d.labelText)}, { exact: true })`;
  }

  if (placeholderUsable(d) && d.placeholder) {
    return `page.getByPlaceholder(${j(d.placeholder)})`;
  }

  if (d.headingLevel && vn) {
    return `page.getByRole('heading', { name: ${j(vn)}, level: ${d.headingLevel} })`;
  }

  if (d.roleAttr === "button" && vn) {
    return `page.getByRole('button', { name: ${j(vn)}, exact: true })`;
  }
  if (d.roleAttr === "link" && vn) {
    return `page.getByRole('link', { name: ${j(vn)}, exact: true })`;
  }
  if (d.roleAttr === "menuitem" && vn) {
    return `page.getByRole('menuitem', { name: ${j(vn)}, exact: true })`;
  }
  if (d.roleAttr === "tab" && vn) {
    return `page.getByRole('tab', { name: ${j(vn)}, exact: true })`;
  }

  if (tag === "a" && vn && !/^https?:\/\//i.test(vn)) {
    return `page.getByRole('link', { name: ${j(vn)}, exact: true })`;
  }

  if (tag === "button" && vn) {
    return `page.getByRole('button', { name: ${j(vn)}, exact: true })`;
  }

  if (tag === "label" && vn) {
    return `page.getByText(${j(vn)}, { exact: true })`;
  }

  if (tag === "input") {
    if (type === "checkbox" && vn) {
      return `page.getByRole('checkbox', { name: ${j(vn)}, exact: true })`;
    }
    if (type === "radio" && vn) {
      return `page.getByRole('radio', { name: ${j(vn)}, exact: true })`;
    }
    if (["submit", "button", "reset"].includes(type) && vn) {
      return `page.getByRole('button', { name: ${j(vn)}, exact: true })`;
    }
    if (["text", "email", "search", "url", "tel", "password", ""].includes(type) && vn) {
      return `page.getByRole('textbox', { name: ${j(vn)}, exact: true })`;
    }
  }

  if (tag === "textarea" && vn) {
    return `page.getByRole('textbox', { name: ${j(vn)}, exact: true })`;
  }

  if (tag === "select" && vn) {
    return `page.getByRole('combobox', { name: ${j(vn)}, exact: true })`;
  }

  if (d.testId) {
    return `page.getByTestId(${j(d.testId)})`;
  }

  if (d.id && !isLikelyDynamicId(d.id)) {
    return `page.locator(${j("#" + d.id)})`;
  }

  if (d.nameAttr && (tag === "input" || tag === "select" || tag === "textarea")) {
    return `page.locator(${j(`[name="${d.nameAttr.replace(/"/g, '\\"')}"]`)})`;
  }

  if (vn.length >= 2 && vn.length <= 120) {
    return `page.getByText(${j(vn)}, { exact: true })`;
  }

  return null;
}

function placeholderUsable(d: PlaywrightRawItem): boolean {
  return Boolean(d.placeholder && d.placeholder.length >= 2 && d.placeholder.length < 120);
}

const SCROLL_PAGE_JS = `
(() => {
  var step = Math.max(400, window.innerHeight * 0.85);
  var y = 0;
  var max = document.documentElement.scrollHeight;
  while (y < max) {
    y = Math.min(y + step, max);
    window.scrollTo(0, y);
  }
  window.scrollTo(0, 0);
})()
`;

async function scrollFullPage(page: Page): Promise<void> {
  await page.evaluate(SCROLL_PAGE_JS);
  await sleep(SCROLL_PAUSE_MS);
}

/**
 * Returns lines: `Human label = page.getByRole(...)` suitable for Playwright Test code.
 * @param locale - "auto" infers from URL (e.g. /ar, hl=ar, .gov.sa → Arabic; else English). Google gets ?hl= for consistency.
 */
export async function extractPlaywrightLocatorLines(
  url: string,
  opts?: { locale?: PlaywrightLocaleMode }
): Promise<string[]> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL must use http or https");
  }

  const mode = opts?.locale ?? "auto";
  const { locale, acceptLanguage, gotoUrl } = resolvePlaywrightLocale(url, mode);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    locale,
    extraHTTPHeaders: {
      "Accept-Language": acceptLanguage,
    },
  });
  const page = await context.newPage();

  try {
    await page.goto(gotoUrl, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
    await scrollFullPage(page);

    const raw = await collectRaw(page);
    const usedCodes = new Set<string>();
    const lines: string[] = [];

    raw.forEach((d, i) => {
      const code = buildPlaywrightLocator(d);
      if (!code) return;
      if (usedCodes.has(code)) return;
      usedCodes.add(code);
      lines.push(`${humanLabel(d, i)} = ${code}`);
    });

    return lines;
  } finally {
    await browser.close();
  }
}
