import type { ParsedKeywordClass, ParsedTestScript, ProjectIndex } from "../projectIntelligence/types.js";
import type { ScriptIssue } from "./types.js";

const OR_PATH_SET = (index: ProjectIndex) => new Set(index.testObjects.map((o) => o.path));

const KEYWORD_PATHS = (index: ProjectIndex) => {
  const set = new Set<string>();
  for (const kw of index.keywords) {
    set.add(kw.customKeywordsPath);
    for (const m of kw.methods) {
      set.add(`${kw.customKeywordsPath}.${m.name}`);
    }
  }
  return set;
};

function lineNumber(content: string, index: number): number {
  return content.slice(0, index).split(/\r?\n/).length;
}

export function analyzeScriptContent(
  content: string,
  meta: ParsedTestScript,
  index: ProjectIndex
): ScriptIssue[] {
  const issues: ScriptIssue[] = [];
  const orPaths = OR_PATH_SET(index);
  const kwPaths = KEYWORD_PATHS(index);

  for (const ref of meta.findTestObjectRefs) {
    if (!orPaths.has(ref)) {
      issues.push({
        ruleId: "missing_test_object",
        severity: "critical",
        message: `findTestObject('${ref}') not found in indexed Object Repository`,
        confidence: 0.95,
      });
    }
  }

  for (const ref of meta.customKeywordRefs) {
    const classPath = ref.split(".").slice(0, -1).join(".");
    if (!kwPaths.has(ref) && !kwPaths.has(classPath)) {
      issues.push({
        ruleId: "missing_keyword",
        severity: "warning",
        message: `CustomKeywords.'${ref}' not found in indexed Keywords`,
        confidence: 0.85,
      });
    }
  }

  const sleepMatch = /\bThread\.sleep\s*\(/gi;
  let m: RegExpExecArray | null;
  while ((m = sleepMatch.exec(content)) !== null) {
    issues.push({
      ruleId: "thread_sleep",
      severity: "warning",
      message: "Prefer WebUI.delay() over Thread.sleep() for Katalon stability",
      line: lineNumber(content, m.index),
      confidence: 0.9,
    });
  }

  if (/WebUI\.click\s*\(/.test(content) && !/WebUI\.delay\s*\(/.test(content)) {
    issues.push({
      ruleId: "missing_wait_after_action",
      severity: "info",
      message: "Consider WebUI.delay() after click/submit for flaky UI stability",
      confidence: 0.6,
    });
  }

  if (/new\s+TestObject\s*\(/.test(content) && meta.findTestObjectRefs.length === 0) {
    issues.push({
      ruleId: "inline_test_object",
      severity: "info",
      message: "Inline TestObject detected — prefer Object Repository for maintainability",
      confidence: 0.75,
    });
  }

  if (/Mobile\.(tap|swipe|press)/i.test(content) && /WebUI\./.test(content)) {
    issues.push({
      ruleId: "mixed_mobile_web",
      severity: "warning",
      message: "Script mixes Mobile and WebUI APIs — verify platform target",
      confidence: 0.8,
    });
  }

  const longXPath = /xpath\s*[:=]\s*['"]([^'"]{120,})['"]/gi;
  while ((m = longXPath.exec(content)) !== null) {
    issues.push({
      ruleId: "fragile_xpath",
      severity: "warning",
      message: "Very long XPath locator — high flake risk",
      line: lineNumber(content, m.index),
      confidence: 0.7,
    });
  }

  return issues;
}
