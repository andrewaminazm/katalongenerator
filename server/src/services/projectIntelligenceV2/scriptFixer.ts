import type { ProjectIndex } from "../projectIntelligence/types.js";
import { matchTestObjectsForStep } from "../projectIntelligence/semanticMatcher.js";
import type { FixExplanation, TestCaseFix } from "./types.js";
import { analyzeScriptContent } from "./scriptAnalyzer.js";
import type { LoadedScript } from "./sourceLoader.js";

function applyDeterministicFixes(content: string, index: ProjectIndex): { fixed: string; explanations: FixExplanation[] } {
  const explanations: FixExplanation[] = [];
  let fixed = content;

  if (/\bThread\.sleep\s*\(\s*(\d+)\s*\)/.test(fixed)) {
    fixed = fixed.replace(/\bThread\.sleep\s*\(\s*(\d+)\s*\)/g, (_, ms) => {
      const seconds = Math.max(1, Math.round(Number(ms) / 1000));
      return `WebUI.delay(${seconds})`;
    });
    explanations.push({
      ruleId: "thread_sleep",
      severity: "warning",
      confidence: 0.92,
      reason: "Replaced Thread.sleep with WebUI.delay for Katalon-compatible waits",
    });
  }

  const missingOr = /findTestObject\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  const orPaths = new Set(index.testObjects.map((o) => o.path));
  fixed = fixed.replace(missingOr, (full, ref: string) => {
    if (orPaths.has(ref)) return full;
    const hint = ref.split("/").pop() ?? ref;
    const matches = matchTestObjectsForStep(hint.replace(/_/g, " "), index.testObjects, 0.35);
    if (matches[0]?.item.path) {
      explanations.push({
        ruleId: "missing_test_object",
        severity: "critical",
        confidence: matches[0].score,
        reason: `Remapped missing OR '${ref}' → '${matches[0].item.path}' (${matches[0].reason})`,
      });
      return `findTestObject('${matches[0].item.path}')`;
    }
    return full;
  });

  if (/WebUI\.click\s*\([^)]+\)/.test(fixed) && !/WebUI\.delay\s*\(/.test(fixed)) {
    fixed = fixed.replace(
      /(WebUI\.click\s*\([^)]+\)\s*)/g,
      "$1\nWebUI.delay(1)\n"
    );
    explanations.push({
      ruleId: "missing_wait_after_action",
      severity: "info",
      confidence: 0.55,
      reason: "Inserted WebUI.delay(1) after click for stability (review timing)",
    });
  }

  return { fixed, explanations };
}

function summarizeDiff(original: string, fixed: string): string[] {
  const oLines = original.split(/\r?\n/);
  const fLines = fixed.split(/\r?\n/);
  const summary: string[] = [];
  const max = Math.max(oLines.length, fLines.length);
  let changes = 0;
  for (let i = 0; i < max && changes < 8; i++) {
    if (oLines[i] !== fLines[i]) {
      summary.push(`Line ${i + 1}: updated`);
      changes++;
    }
  }
  if (changes === 0) summary.push("No line changes (structure preserved)");
  return summary;
}

export function fixScript(
  loaded: LoadedScript,
  index: ProjectIndex
): TestCaseFix {
  const meta = index.testScripts.find((s) => s.scriptPath === loaded.scriptPath);
  const issues = meta ? analyzeScriptContent(loaded.content, meta, index) : [];
  const { fixed, explanations: fixExplanations } = applyDeterministicFixes(loaded.content, index);

  const explanations: FixExplanation[] = [
    ...issues.map((i) => ({
      ruleId: i.ruleId,
      severity: i.severity,
      confidence: i.confidence,
      reason: i.message,
    })),
    ...fixExplanations,
  ];

  const changed = fixed !== loaded.content;

  return {
    scriptPath: loaded.scriptPath,
    logicalPath: loaded.logicalPath,
    original: loaded.content,
    fixed,
    diffSummary: changed ? summarizeDiff(loaded.content, fixed) : ["No automatic fixes applied"],
    explanations,
    changed,
  };
}

export function fixAllScripts(loaded: LoadedScript[], index: ProjectIndex): TestCaseFix[] {
  return loaded.map((s) => fixScript(s, index));
}
