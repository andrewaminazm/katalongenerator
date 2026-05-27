import { lintGroovy } from "../groovyLint.js";
import { fixScript } from "../projectIntelligenceV2/scriptFixer.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import { analyzeScriptContent } from "../projectIntelligenceV2/scriptAnalyzer.js";
import type { RepairDiff, RepairSuggestion } from "./types.js";
import { buildRepairDiff } from "./repairDiffGenerator.js";
import { repairImports } from "./importRepairEngine.js";

export function analyzeGroovyScripts(
  scripts: LoadedScript[],
  index: ProjectIndex
): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];
  const orPaths = new Set(index.testObjects.map((o) => o.path));

  for (const s of scripts) {
    const meta = index.testScripts.find((x) => x.scriptPath === s.scriptPath);
    if (!meta) continue;

    const issues = analyzeScriptContent(s.content, meta, index);
    for (const issue of issues) {
      suggestions.push({
        id: `script-${issue.ruleId}-${s.scriptPath}`,
        category: "script",
        severity:
          issue.severity === "critical"
            ? "critical"
            : issue.severity === "warning"
              ? "medium"
              : "info",
        confidence: issue.confidence,
        priority: issue.severity === "critical" ? 90 : 60,
        title: `${issue.ruleId} in ${s.logicalPath}`,
        detail: issue.message,
        whyItMatters: "Script issues cause runtime failures or flaky execution in Katalon.",
        affectedFiles: [s.scriptPath],
        suggestedFix: "Apply deterministic script repair (waits, OR remap, lint fixes).",
        autoApplicable: ["thread_sleep", "missing_test_object", "fragile_xpath"].includes(issue.ruleId),
      });
    }

    const lint = lintGroovy(s.content, orPaths, { platform: "web" });
    for (const l of lint.filter((x) => x.severity === "error").slice(0, 3)) {
      suggestions.push({
        id: `lint-${l.rule}-${s.scriptPath}-${l.line ?? 0}`,
        category: "script",
        severity: "high",
        confidence: 0.88,
        priority: 80,
        title: `Lint: ${l.rule} in ${s.logicalPath}`,
        detail: l.message,
        whyItMatters: "Lint errors often fail compilation in Katalon Studio.",
        affectedFiles: [s.scriptPath],
        suggestedFix: "Fix per Katalon Groovy lint rules.",
        autoApplicable: l.rule === "no-raw-selenium",
      });
    }
  }

  return suggestions;
}

export function repairGroovyScript(
  loaded: LoadedScript,
  index: ProjectIndex,
  suggestionId: string
): RepairDiff {
  const fix = fixScript(loaded, index);
  let repaired = fix.fixed;
  repaired = repairImports(repaired);

  const orPaths = new Set(index.testObjects.map((o) => o.path));
  const lint = lintGroovy(repaired, orPaths, { platform: "web" });

  return buildRepairDiff({
    filePath: loaded.scriptPath,
    category: "script",
    suggestionId,
    original: loaded.content,
    repaired,
    lintWarnings: lint.map((l) => `${l.severity}: ${l.message}`),
  });
}
