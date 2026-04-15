import AdmZip from "adm-zip";

const OR_FILE = /\.(rs|xml)$/i;
const GROOVY = /\.groovy$/i;
const TC_EXT = /\.tc$/i;
const TS_FILE = /\.ts$/i;

/** Normalize zip entry name to forward slashes. */
function normPath(name: string): string {
  return name.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

function hasArabicScript(s: string): boolean {
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
}

/**
 * Multipart `originalname` may be mojibake (UTF-8 bytes read as Latin-1). Recover when Arabic appears after reinterpretation.
 */
function normalizeMultipartFilename(name: string): string {
  const n = normPath(name);
  if (!n.trim()) return n;
  try {
    const u = normPath(Buffer.from(name, "latin1").toString("utf8"));
    if (u !== n && hasArabicScript(u) && !hasArabicScript(n)) return u;
  } catch {
    /* noop */
  }
  return n;
}

function skipNoise(rel: string): boolean {
  if (!rel) return true;
  if (/^__MACOSX\//i.test(rel) || rel.includes(".DS_Store")) return true;
  return false;
}

/**
 * Extract Katalon-style Object Repository paths from a project .zip.
 * Expects entries like `.../Object Repository/Page_Login/btn_Login.rs`.
 * Works with a **partial** zip that only contains `Object Repository/`.
 */
export function extractObjectRepositoryPathsFromZip(buffer: Buffer): string[] {
  const zip = new AdmZip(buffer);
  const out = new Set<string>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const full = normPath(entry.entryName);
    const idx = full.search(/Object Repository\//i);
    if (idx < 0) continue;
    const after = full.slice(idx + "Object Repository/".length);
    if (skipNoise(after) || !after || !OR_FILE.test(after)) continue;
    const pathOnly = after.replace(OR_FILE, "").replace(/\/+$/, "");
    if (pathOnly) out.add(pathOnly);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/**
 * Extract test case folder paths from a zip (partial `Test Cases/` tree is enough).
 * Recognizes `.../Test Cases/<path>/Script.groovy`, `.../<path>.groovy`, `.../<path>.tc`.
 */
export function extractTestCasePathsFromZip(buffer: Buffer): string[] {
  const zip = new AdmZip(buffer);
  const out = new Set<string>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const full = normPath(entry.entryName);
    const idx = full.search(/Test Cases\//i);
    if (idx < 0) continue;
    let after = full.slice(idx + "Test Cases/".length);
    if (skipNoise(after) || !after) continue;

    const scriptM = after.match(/^(.+)\/Script\.groovy$/i);
    if (scriptM) {
      const p = scriptM[1].replace(/\/+$/, "");
      if (p) out.add(p);
      continue;
    }
    if (GROOVY.test(after)) {
      const p = after.replace(GROOVY, "").replace(/\/+$/, "");
      if (p) out.add(p);
      continue;
    }
    if (TC_EXT.test(after)) {
      const p = after.replace(TC_EXT, "").replace(/\/+$/, "");
      if (p) out.add(p);
      continue;
    }
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/**
 * Extract test suite names from a zip (partial `Test Suites/` tree).
 * Expects `.../Test Suites/<Name>.ts`.
 */
export function extractTestSuitePathsFromZip(buffer: Buffer): string[] {
  const zip = new AdmZip(buffer);
  const out = new Set<string>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    const full = normPath(entry.entryName);
    const idx = full.search(/Test Suites\//i);
    if (idx < 0) continue;
    let after = full.slice(idx + "Test Suites/".length);
    if (skipNoise(after) || !after || !TS_FILE.test(after)) continue;
    const name = after.replace(TS_FILE, "").replace(/\/+$/, "");
    if (name) out.add(name);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/**
 * Infer OR paths from uploaded single files (filename may include folders).
 * Multipart filenames may be `webkitRelativePath` from a folder upload, e.g.
 * `aboutgosi/Page_/Page_/file.rs`, or include `Object Repository/` (stripped).
 */
export function extractPathsFromUploadedOrFiles(
  files: Array<{ originalname: string }>
): string[] {
  const out = new Set<string>();
  for (const f of files) {
    let n = normalizeMultipartFilename(f.originalname);
    if (!OR_FILE.test(n)) continue;
    const lower = n.toLowerCase();
    const marker = "object repository/";
    const idx = lower.indexOf(marker);
    if (idx >= 0) {
      n = n.slice(idx + marker.length);
    }
    const pathOnly = n
      .replace(OR_FILE, "")
      .replace(/\/+$/, "")
      .replace(/^\/+/, "");
    if (pathOnly) out.add(pathOnly);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/**
 * Infer test case paths from uploaded `.groovy` / `.tc` files (paths may include `Test Cases/`).
 */
export function extractPathsFromUploadedTestCaseFiles(
  files: Array<{ originalname: string }>
): string[] {
  const out = new Set<string>();
  for (const f of files) {
    let n = normalizeMultipartFilename(f.originalname);
    if (!GROOVY.test(n) && !TC_EXT.test(n)) continue;
    n = n.replace(/^.*Test Cases\//i, "");
    if (/^(.+)\/Script\.groovy$/i.test(n)) {
      const p = n.replace(/\/Script\.groovy$/i, "").replace(/\/+$/, "");
      if (p) out.add(p);
      continue;
    }
    const p = n.replace(GROOVY, "").replace(TC_EXT, "").replace(/\/+$/, "");
    if (p) out.add(p);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}

/**
 * Infer test suite names from uploaded `.ts` files under Test Suites.
 */
export function extractPathsFromUploadedTestSuiteFiles(
  files: Array<{ originalname: string }>
): string[] {
  const out = new Set<string>();
  for (const f of files) {
    let n = normalizeMultipartFilename(f.originalname);
    if (!TS_FILE.test(n)) continue;
    n = n.replace(/^.*Test Suites\//i, "");
    const name = n.replace(TS_FILE, "").replace(/\/+$/, "");
    if (name) out.add(name);
  }
  return [...out].sort((a, b) => a.localeCompare(b));
}
