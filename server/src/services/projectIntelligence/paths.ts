import type { TestScriptKind } from "./types.js";

export const KATALON_FOLDERS = {
  objectRepository: "Object Repository",
  keywords: "Keywords",
  testCases: "Test Cases",
  scripts: "Scripts",
  testSuites: "Test Suites",
  profiles: "Profiles",
  includeGroovy: "Include/scripts/groovy",
  libs: "Libs",
} as const;

/** Groovy files to index as test scripts (not Keywords / suite metadata). */
export function classifyTestScriptPath(relPath: string): TestScriptKind | null {
  const norm = normalizeRelPath(relPath);
  if (!/\.groovy$/i.test(norm)) return null;
  if (/Keywords\//i.test(norm)) return null;
  if (/Test Suites\//i.test(norm)) return null;
  if (/Scripts\//i.test(norm)) return "scripts";
  if (/Test Cases\//i.test(norm)) return "test_case";
  if (/Include\/scripts\/groovy\//i.test(norm)) return "include";
  if (/Libs\//i.test(norm)) return "lib";
  if (/Test Listeners\//i.test(norm)) return "listener";
  return null;
}

/** Human-readable script id (folder path without auto-generated Script*.groovy name). */
export function testScriptLogicalPath(relPath: string, kind: TestScriptKind): string {
  const norm = normalizeRelPath(relPath);
  const stripGenerated = (after: string): string => {
    const m = after.match(/^(.+)\/Script\d+\.groovy$/i);
    if (m) return m[1].replace(/\/+$/, "");
    if (/^Script\d+\.groovy$/i.test(after)) return after.replace(/^Script/i, "").replace(/\.groovy$/i, "");
    return after.replace(/\.groovy$/i, "").replace(/\/+$/, "");
  };

  if (kind === "scripts") {
    const idx = norm.search(/Scripts\//i);
    if (idx >= 0) return stripGenerated(norm.slice(idx));
  }
  if (kind === "test_case") {
    const idx = norm.search(/Test Cases\//i);
    if (idx >= 0) return stripGenerated(norm.slice(idx));
  }
  if (kind === "include") {
    const idx = norm.search(/Include\/scripts\/groovy\//i);
    if (idx >= 0) {
      const after = norm.slice(idx + "Include/scripts/groovy/".length);
      return `Include/scripts/groovy/${stripGenerated(after)}`;
    }
  }
  if (kind === "lib") {
    const idx = norm.search(/Libs\//i);
    if (idx >= 0) return stripGenerated(norm.slice(idx));
  }
  return norm.replace(/\.groovy$/i, "");
}

/** @deprecated Use testScriptLogicalPath */
export function testCasePathFromScript(relPath: string): string | null {
  const kind = classifyTestScriptPath(relPath);
  if (kind !== "test_case" && kind !== "scripts") return null;
  return testScriptLogicalPath(relPath, kind);
}

export function toPosix(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\/+/, "");
}

export function normalizeRelPath(p: string): string {
  return toPosix(p).replace(/\/+/g, "/").replace(/^\/+/, "");
}

/** OR path from file path under Object Repository (no extension). */
export function orPathFromRsFile(relPath: string): string | null {
  const norm = normalizeRelPath(relPath);
  const idx = norm.search(/Object Repository\//i);
  if (idx < 0) return null;
  let after = norm.slice(idx + "Object Repository/".length);
  if (!/\.rs$/i.test(after)) return null;
  return after.replace(/\.rs$/i, "").replace(/\/+$/, "");
}

export function keywordPackageFromPath(relPath: string): string {
  const norm = normalizeRelPath(relPath);
  const idx = norm.search(/Keywords\//i);
  if (idx < 0) return "";
  const after = norm.slice(idx + "Keywords/".length).replace(/\.groovy$/i, "");
  return after.replace(/\//g, ".").replace(/^\.+/, "");
}
