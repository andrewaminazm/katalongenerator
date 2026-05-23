import type { ParsedTestScript, TestScriptKind } from "./types.js";
import {
  classifyTestScriptPath,
  normalizeRelPath,
  testScriptLogicalPath,
} from "./paths.js";

function extractRefs(script: string): {
  findTestObjectRefs: string[];
  customKeywordRefs: string[];
  stepComments: string[];
  webUiCalls: string[];
} {
  const findTestObjectRefs: string[] = [];
  const customKeywordRefs: string[] = [];
  const stepComments: string[] = [];
  const webUiCalls: string[] = [];

  const fo = /findTestObject\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = fo.exec(script)) !== null) {
    findTestObjectRefs.push(m[1]);
  }

  const ck = /CustomKeywords\s*\.\s*'([^']+)'/gi;
  while ((m = ck.exec(script)) !== null) {
    customKeywordRefs.push(m[1]);
  }

  const comments = script.match(/\/\/\s*Step:.*$/gim) ?? [];
  for (const c of comments) stepComments.push(c.replace(/^\/\/\s*/i, "").trim());

  const webUi = /\bWebUI\.(\w+)\s*\(/g;
  while ((m = webUi.exec(script)) !== null) {
    webUiCalls.push(`WebUI.${m[1]}`);
  }

  return {
    findTestObjectRefs: [...new Set(findTestObjectRefs)],
    customKeywordRefs: [...new Set(customKeywordRefs)],
    stepComments,
    webUiCalls: [...new Set(webUiCalls)],
  };
}

function semanticSummary(logicalPath: string, kind: TestScriptKind, refs: string[]): string {
  const leaf = logicalPath.split("/").pop() ?? logicalPath;
  const prefix =
    kind === "scripts"
      ? "Test script"
      : kind === "test_case"
        ? "Test case script"
        : kind === "include"
          ? "Include script"
          : kind === "lib"
            ? "Library script"
            : "Groovy script";
  const hint = refs.length > 0 ? ` (uses ${refs.slice(0, 3).join(", ")})` : "";
  return `${prefix}: ${leaf}${hint}`;
}

export function parseTestScriptFile(relPath: string, content: string): ParsedTestScript | null {
  try {
    const norm = normalizeRelPath(relPath);
    const kind = classifyTestScriptPath(norm);
    if (!kind) return null;

    const logicalPath = testScriptLogicalPath(norm, kind);
    const refs = extractRefs(content);
    const lineCount = content.split(/\r?\n/).length;

    return {
      logicalPath,
      scriptPath: norm,
      kind,
      displayName: logicalPath.split("/").pop() ?? logicalPath,
      ...refs,
      lineCount,
      semanticSummary: semanticSummary(logicalPath, kind, [
        ...refs.findTestObjectRefs,
        ...refs.customKeywordRefs,
      ]),
    };
  } catch {
    return null;
  }
}

/** @deprecated Use parseTestScriptFile */
export const parseTestCaseScript = parseTestScriptFile;
