import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Lightweight Markdown → HTML converter.
 * Goal: readable PDF documentation without adding new deps.
 * Supports: headings, paragraphs, fenced code blocks, inline code, lists, images, horizontal rules.
 */
function mdToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];

  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let listMode: "ul" | null = null;

  const flushList = () => {
    if (!listMode) return;
    out.push(listMode === "ul" ? "</ul>" : "");
    listMode = null;
  };

  const flushCode = () => {
    if (!inCode) return;
    const code = escapeHtml(codeBuf.join("\n"));
    out.push(
      `<pre class="code"><code data-lang="${escapeHtml(codeLang)}">${code}</code></pre>`
    );
    inCode = false;
    codeLang = "";
    codeBuf = [];
  };

  for (const rawLine of lines) {
    const line = rawLine ?? "";

    // Fenced code blocks
    const fence = line.match(/^```(\w+)?\s*$/);
    if (fence) {
      if (inCode) {
        flushCode();
      } else {
        flushList();
        inCode = true;
        codeLang = fence[1] ?? "";
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // HR
    if (/^\s*---\s*$/.test(line)) {
      flushList();
      out.push("<hr />");
      continue;
    }

    // Images: ![alt](path)
    const img = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      flushList();
      const alt = escapeHtml(img[1] ?? "");
      const src = escapeHtml(img[2] ?? "");
      out.push(`<figure class="img"><img alt="${alt}" src="${src}" /><figcaption>${alt}</figcaption></figure>`);
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h) {
      flushList();
      const level = h[1].length;
      out.push(`<h${level}>${inlineMd(h[2])}</h${level}>`);
      continue;
    }

    // Bullet list items (ul)
    const li = line.match(/^\s*-\s+(.+?)\s*$/);
    if (li) {
      if (!listMode) {
        listMode = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${inlineMd(li[1])}</li>`);
      continue;
    }

    // Blank line
    if (!line.trim()) {
      flushList();
      continue;
    }

    // Paragraph
    flushList();
    out.push(`<p>${inlineMd(line)}</p>`);
  }

  flushCode();
  flushList();
  return out.join("\n");
}

function inlineMd(s: string): string {
  const escaped = escapeHtml(s);
  // inline code
  return escaped.replace(/`([^`]+)`/g, (_m, g1) => `<code class="inline">${escapeHtml(g1)}</code>`);
}

function wrapHtml(bodyHtml: string): string {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Project Guide — Katalon Script Generator</title>
  <style>
    :root {
      --fg: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
      --bg: #ffffff;
      --code-bg: #0b1020;
      --code-fg: #e5e7eb;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
    }
    html, body { background: var(--bg); color: var(--fg); font-family: var(--sans); }
    body { margin: 0; padding: 32px 44px; }
    h1, h2, h3, h4 { margin: 22px 0 10px; }
    h1 { font-size: 28px; letter-spacing: -0.01em; }
    h2 { font-size: 20px; padding-top: 8px; border-top: 1px solid var(--border); }
    h3 { font-size: 16px; }
    p, li { font-size: 12.5px; line-height: 1.55; color: var(--fg); }
    li { margin: 4px 0; }
    ul { padding-left: 18px; }
    hr { border: none; border-top: 1px solid var(--border); margin: 18px 0; }
    code.inline {
      font-family: var(--mono);
      font-size: 0.95em;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 6px;
      border: 1px solid var(--border);
    }
    pre.code {
      background: var(--code-bg);
      color: var(--code-fg);
      padding: 14px 14px;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.08);
      margin: 10px 0 14px;
    }
    pre.code code {
      font-family: var(--mono);
      font-size: 11.5px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    figure.img { margin: 14px 0; padding: 12px; border: 1px solid var(--border); border-radius: 12px; }
    figure.img img { max-width: 100%; height: auto; border-radius: 8px; }
    figure.img figcaption { font-size: 11px; color: var(--muted); margin-top: 8px; }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

async function main() {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const mdPath = path.resolve(repoRoot, "docs", "PROJECT_GUIDE.md");
  const htmlPath = path.resolve(repoRoot, "docs", "PROJECT_GUIDE.html");
  const pdfPath = path.resolve(repoRoot, "docs", "PROJECT_GUIDE.pdf");

  const md = fs.readFileSync(mdPath, "utf8");
  const html = wrapHtml(mdToHtml(md));
  fs.writeFileSync(htmlPath, html, "utf8");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Load from file:// so relative asset paths (e.g. ../assets/...) resolve.
  const fileUrl = `file://${htmlPath.replace(/\\/g, "/")}`;
  await page.goto(fileUrl, { waitUntil: "load" });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  });

  await browser.close();
  console.log(`Wrote ${path.relative(repoRoot, pdfPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

