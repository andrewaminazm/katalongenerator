import fs from "node:fs";
import path from "node:path";
import { mdToHtml, wrapHtml } from "../src/services/markdownPdf/markdownToPdf.js";
import { chromium } from "playwright";

async function main() {
  const repoRoot = path.resolve(import.meta.dirname, "..", "..");
  const docBase =
    process.argv[2]?.trim().replace(/\.md$/i, "").replace(/\.pdf$/i, "") || "PROJECT_GUIDE";
  const mdPath = path.resolve(repoRoot, "docs", `${docBase}.md`);
  const htmlPath = path.resolve(repoRoot, "docs", `${docBase}.html`);
  const pdfPath = path.resolve(repoRoot, "docs", `${docBase}.pdf`);

  if (!fs.existsSync(mdPath)) {
    console.error(`Markdown file not found: ${mdPath}`);
    process.exitCode = 1;
    return;
  }

  const titles: Record<string, string> = {
    PROJECT_GUIDE: "Project Guide — Katalon Script Generator",
    USER_GUIDE: "User Guide — Katalon Script Generator",
  };
  const documentTitle = titles[docBase] ?? `${docBase} — Katalon Script Generator`;

  const md = fs.readFileSync(mdPath, "utf8");
  const html = wrapHtml(mdToHtml(md), documentTitle);
  fs.writeFileSync(htmlPath, html, "utf8");

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const fileUrl = `file://${htmlPath.replace(/\\/g, "/")}`;
  await page.goto(fileUrl, { waitUntil: "load" });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
  });

  await browser.close();
  console.log(`Wrote ${path.relative(repoRoot, pdfPath)} (from ${path.relative(repoRoot, mdPath)})`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
