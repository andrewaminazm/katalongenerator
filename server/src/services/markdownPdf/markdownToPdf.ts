import { chromium } from "playwright";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Lightweight Markdown → HTML for PDF rendering. */
export function mdToHtml(md: string): string {
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

    if (/^\s*---\s*$/.test(line)) {
      flushList();
      out.push("<hr />");
      continue;
    }

    const img = line.match(/^\s*!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      flushList();
      const alt = escapeHtml(img[1] ?? "");
      const src = escapeHtml(img[2] ?? "");
      out.push(
        `<figure class="img"><img alt="${alt}" src="${src}" /><figcaption>${alt}</figcaption></figure>`
      );
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (h) {
      flushList();
      const level = h[1].length;
      out.push(`<h${level}>${inlineMd(h[2])}</h${level}>`);
      continue;
    }

    const li = line.match(/^\s*-\s+(.+?)\s*$/);
    if (li) {
      if (!listMode) {
        listMode = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${inlineMd(li[1])}</li>`);
      continue;
    }

    if (!line.trim()) {
      flushList();
      continue;
    }

    flushList();
    out.push(`<p>${inlineMd(line)}</p>`);
  }

  flushCode();
  flushList();
  return out.join("\n");
}

function inlineMd(s: string): string {
  const escaped = escapeHtml(s);
  return escaped.replace(/`([^`]+)`/g, (_m, g1) => `<code class="inline">${escapeHtml(g1)}</code>`);
}

export function wrapHtml(bodyHtml: string, documentTitle: string): string {
  const safeTitle = escapeHtml(documentTitle);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
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

/** Render Markdown as an A4 PDF buffer (Playwright + Chromium). */
export async function markdownToPdfBuffer(
  markdown: string,
  documentTitle: string
): Promise<Buffer> {
  const html = wrapHtml(mdToHtml(markdown), documentTitle);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
    });
  } finally {
    await browser.close();
  }
}
