import { XMLParser } from "fast-xml-parser";
import type { KatalonProjectContext } from "../types/index.js";

const MAX_LIST_ITEMS = 400;
const MAX_STR = 500;
/** Max characters of raw XML embedded in the LLM prompt (large exports are truncated). */
const MAX_XML_IN_PROMPT = 100_000;

function uniqCap(arr: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    const t = s.trim().slice(0, MAX_STR);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

function collectStringLeaves(obj: unknown, out: Set<string>, depth: number): void {
  if (depth > 50 || obj === null || obj === undefined) return;
  if (typeof obj === "string") {
    const t = obj.trim();
    if (t.length >= 2 && t.length <= MAX_STR) out.add(t);
    return;
  }
  if (Array.isArray(obj)) {
    for (const x of obj) collectStringLeaves(x, out, depth + 1);
    return;
  }
  if (typeof obj === "object") {
    for (const v of Object.values(obj)) collectStringLeaves(v, out, depth + 1);
  }
}

function looksLikeObjectRepoPath(s: string): boolean {
  if (!s.includes("/") || s.length < 3 || s.length > 250) return false;
  if (/^https?:/i.test(s) || s.includes("://")) return false;
  return /^[A-Za-z0-9_./\- ]+$/.test(s);
}

/** Script folders, disk paths, and .prj metadata — NOT Object Repository test object paths. */
function isExcludedNonOrPath(s: string): boolean {
  const t = s.trim();
  const lower = t.toLowerCase();
  if (/^[a-z]:[\\/]/i.test(t)) return true;
  if (lower.endsWith(".prj") || lower.endsWith(".groovy") || lower.endsWith(".java")) return true;
  if (lower.startsWith("include/")) return true;
  if (lower.startsWith("settings/") || lower.startsWith("bin/") || lower.startsWith("plugins/")) return true;
  if (lower.startsWith("testops/") || lower.includes("internal")) return true;
  if (lower.includes("scripts/groovy") && !lower.includes("object repository")) return true;
  return false;
}

function extractFindTestObjectPaths(xml: string): string[] {
  const out: string[] = [];
  const re = /findTestObject\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function extractCustomKeywordRefs(xml: string): string[] {
  const out: string[] = [];
  const re = /CustomKeywords\s*\.\s*'([^']+)'/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    out.push(m[1]);
  }
  return out;
}

function extractTestCaseLikePaths(xml: string, leaves: Set<string>): string[] {
  const out: string[] = [];
  const re = /\bTest Cases\/[A-Za-z0-9_/.\- ]+/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const s = m[0].replace(/\s+$/, "");
    if (s.length <= 250) out.push(s);
  }
  for (const s of leaves) {
    if (s.includes("Test Cases/") && s.length <= 250) out.push(s);
  }
  return out;
}

function guessProjectName(parsed: unknown, xml: string): string | undefined {
  if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
    const o = parsed as Record<string, unknown>;
    for (const key of ["Project", "project", "Root", "WebElementEntity", "WebServiceEntity"]) {
      const v = o[key];
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        const n = (v as Record<string, unknown>)["name"];
        if (typeof n === "string" && n.trim()) return n.trim().slice(0, MAX_STR);
      }
    }
    const n = o["name"];
    if (typeof n === "string" && n.trim() && n.length < 200) return n.trim();
  }
  const m = xml.match(/<project[^>]*name\s*=\s*["']([^"']+)["']/i);
  if (m) return m[1].trim().slice(0, MAX_STR);
  return undefined;
}

/**
 * Parses Katalon-related XML from the request body. Returns undefined if empty.
 * @throws Error if non-empty input is not valid XML.
 */
export function normalizeKatalonProjectXml(raw: unknown): KatalonProjectContext | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") {
    throw new Error("katalonProjectXml must be a string containing XML.");
  }
  const xml = raw.trim().replace(/^\uFEFF/, "");
  if (!xml) return undefined;
  if (!xml.startsWith("<")) {
    throw new Error("katalonProjectXml must be valid XML (expected content to start with '<').");
  }

  let parsed: unknown;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
      trimValues: true,
    });
    parsed = parser.parse(xml);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid XML: ${msg}`);
  }

  const leaves = new Set<string>();
  collectStringLeaves(parsed, leaves, 0);

  const fromFind = extractFindTestObjectPaths(xml).filter((p) => !isExcludedNonOrPath(p));
  const fromKeywords = extractCustomKeywordRefs(xml);
  const fromLeavesOr = [...leaves]
    .filter(looksLikeObjectRepoPath)
    .filter((p) => !isExcludedNonOrPath(p));
  const objectRepository = uniqCap([...fromFind, ...fromLeavesOr], MAX_LIST_ITEMS);
  const keywords = uniqCap([...fromKeywords], MAX_LIST_ITEMS);
  const testCases = uniqCap(extractTestCaseLikePaths(xml, leaves), MAX_LIST_ITEMS);

  const projectName = guessProjectName(parsed, xml);

  const importHints: string[] = [];
  if (/<\s*Project\b/i.test(xml)) {
    importHints.push(
      "XML looks like a Katalon .prj (project descriptor): <url> / sourceFolder entries such as Include/scripts/groovy are Groovy script locations, NOT Object Repository paths. Never prefix those URLs onto Page_* names for findTestObject. For real objects, paste Object Repository (.rs) XML or add locators in the UI."
    );
  }

  const sourceXml =
    xml.length > MAX_XML_IN_PROMPT
      ? `${xml.slice(0, MAX_XML_IN_PROMPT)}\n\n<!-- …XML truncated after ${MAX_XML_IN_PROMPT} characters for prompt size. -->`
      : xml;

  const has =
    projectName ||
    (objectRepository.length ?? 0) > 0 ||
    (keywords.length ?? 0) > 0 ||
    (testCases.length ?? 0) > 0 ||
    sourceXml.length > 0;

  if (!has) return undefined;

  return {
    projectName,
    frameworkType: undefined,
    keywords: keywords.length ? keywords : undefined,
    objectRepository: objectRepository.length ? objectRepository : undefined,
    testCases: testCases.length ? testCases : undefined,
    sourceXml,
    importHints: importHints.length ? importHints : undefined,
  };
}
