import fs from "node:fs/promises";
import path from "node:path";
import { parseObjectRepositoryRs } from "./objectRepositoryParser.js";
import { parseKeywordGroovyFile } from "./keywordParser.js";
import { parseTestScriptFile } from "./testScriptParser.js";
import { classifyTestScriptPath } from "./paths.js";
import { buildKnowledgeGraph } from "./projectKnowledgeGraph.js";
import { detectReusableFlows } from "./reusableFlowDetector.js";
import { normalizeRelPath, orPathFromRsFile } from "./paths.js";
import type { ProjectIndex, ProjectIndexStats } from "./types.js";

const MAX_FILE_BYTES = 2_000_000;

function skipEntry(rel: string): boolean {
  if (!rel) return true;
  if (/^__MACOSX\//i.test(rel) || rel.includes(".DS_Store")) return true;
  return false;
}

async function walkFiles(rootDir: string): Promise<{ rel: string; abs: string }[]> {
  const out: { rel: string; abs: string }[] = [];
  async function walk(dir: string, prefix: string): Promise<void> {
    let entries: { name: string; isDirectory: () => boolean }[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs, rel);
      } else {
        out.push({ rel: normalizeRelPath(rel), abs });
      }
    }
  }
  await walk(rootDir, "");
  return out;
}

async function readFileSafe(abs: string): Promise<string | null> {
  try {
    const st = await fs.stat(abs);
    if (st.size > MAX_FILE_BYTES) return null;
    return await fs.readFile(abs, "utf8");
  } catch {
    return null;
  }
}

export interface ScanOptions {
  projectId: string;
  projectName: string;
  sourceType: "zip" | "rar" | "folder";
  rootDir: string;
}

/**
 * Scan extracted project directory and build full index (sync, fault-tolerant per file).
 */
export async function scanProjectDirectory(options: ScanOptions): Promise<ProjectIndex> {
  const files = await walkFiles(options.rootDir);
  const testObjects: ProjectIndex["testObjects"] = [];
  const keywords: ProjectIndex["keywords"] = [];
  const testScripts: ProjectIndex["testScripts"] = [];
  const testSuitePaths: string[] = [];
  const profilePaths: string[] = [];
  const globalVariableHints: string[] = [];
  let parseErrors = 0;

  for (const { rel, abs } of files) {
    if (skipEntry(rel)) continue;

    if (/\.rs$/i.test(rel) && /Object Repository\//i.test(rel)) {
      const content = await readFileSafe(abs);
      if (!content) {
        parseErrors++;
        continue;
      }
      const parsed = parseObjectRepositoryRs(rel, content);
      if (parsed) {
        const pathKey = orPathFromRsFile(rel);
        if (pathKey) parsed.path = pathKey;
        testObjects.push(parsed);
      } else {
        const fallbackPath = orPathFromRsFile(rel);
        if (fallbackPath) {
          testObjects.push({
            label: fallbackPath.split("/").pop() ?? fallbackPath,
            path: fallbackPath,
            selectorType: "UNKNOWN",
            selector: "",
            alternativeSelectors: [],
            sourceFile: rel,
          });
        } else parseErrors++;
      }
      continue;
    }

    if (/Keywords\//i.test(rel) && /\.groovy$/i.test(rel)) {
      const content = await readFileSafe(abs);
      if (!content) {
        parseErrors++;
        continue;
      }
      const kw = parseKeywordGroovyFile(rel, content);
      if (kw) keywords.push(kw);
      else parseErrors++;
      continue;
    }

    if (classifyTestScriptPath(rel)) {
      const content = await readFileSafe(abs);
      if (!content) {
        parseErrors++;
        continue;
      }
      const script = parseTestScriptFile(rel, content);
      if (script) testScripts.push(script);
      else parseErrors++;
      continue;
    }

    if (/Test Suites\//i.test(rel) && /\.ts$/i.test(rel)) {
      const name = rel.split(/Test Suites\//i)[1]?.replace(/\.ts$/i, "").replace(/\/+$/, "");
      if (name) testSuitePaths.push(name);
    }

    if (/Profiles\//i.test(rel)) {
      profilePaths.push(rel);
    }

    if (/\.glbl$/i.test(rel) || /GlobalVariable/i.test(rel)) {
      globalVariableHints.push(rel);
    }
  }

  const reusableFlows = detectReusableFlows(testScripts);
  const graph = buildKnowledgeGraph(testObjects, keywords, testScripts, reusableFlows);

  const stats: ProjectIndexStats = {
    testObjects: testObjects.length,
    keywords: keywords.length,
    keywordMethods: keywords.reduce((n, k) => n + k.methods.length, 0),
    testScripts: testScripts.length,
    testSuites: testSuitePaths.length,
    profiles: profilePaths.length,
    groovyLibs: testScripts.filter((s) => s.kind === "include" || s.kind === "lib").length,
    parseErrors,
  };

  const codingStyleHints: string[] = [];
  if (keywords.length > 0) {
    codingStyleHints.push("Prefer CustomKeywords for flows already implemented in Keywords/.");
  }
  if (testObjects.length > 50) {
    codingStyleHints.push("Large Object Repository — use findTestObject with existing paths.");
  }

  return {
    projectId: options.projectId,
    projectName: options.projectName,
    uploadDate: new Date().toISOString(),
    sourceType: options.sourceType,
    testObjects,
    keywords,
    testScripts,
    testSuitePaths: [...new Set(testSuitePaths)].sort(),
    profilePaths: [...new Set(profilePaths)].sort(),
    globalVariableHints,
    reusableFlows,
    graph,
    stats,
    codingStyleHints,
  };
}

export { extractArchiveToDir, extractZipToDir, extractRarToDir, detectArchiveKind } from "./archiveExtract.js";
export type { ArchiveKind } from "./archiveExtract.js";
