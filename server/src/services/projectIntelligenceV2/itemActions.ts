import { loadProjectIndex } from "../projectIntelligence/projectStore.js";
import { extractProjectDefaultUrl } from "../projectIntelligence/projectUrlResolver.js";
import { generateRuleBasedFallbacks } from "../healing/fallbackLocatorGenerator.js";
import type { FallbackLocator } from "../healing/types.js";
import { scoreHealingCandidate } from "../healing/healingScorer.js";
import { buildProjectGraphV2, findImpactedTests } from "./projectGraphV2.js";
import { fixScript } from "./scriptFixer.js";
import { loadScriptContents } from "./sourceLoader.js";
import { proposeBetterSelector } from "./orHealer.js";
import { scoreOrObject } from "./orAnalyzer.js";
import { analyzeScriptContent } from "./scriptAnalyzer.js";
import { buildOrLocatorSnippet, buildRsSelectorHint } from "./rsSnippet.js";
import type { ObjectRepositoryFix, TestCaseFix } from "./types.js";

export interface ScriptFixItemResult {
  fix: TestCaseFix;
  issues: { ruleId: string; severity: string; message: string; confidence: number }[];
}

export interface LocatorHealItemResult {
  orPath: string;
  label: string;
  oldLocator: { type: string; value: string };
  newLocator: { type: string; value: string };
  confidence: number;
  reason: string;
  impactedScripts: string[];
  candidates: { type: string; value: string; score: number; source: string }[];
  katalonSnippet: string;
  rsPreview: string;
  playwrightUsed: boolean;
  warnings: string[];
}

export async function fixProjectScript(
  projectId: string,
  scriptPath: string
): Promise<ScriptFixItemResult> {
  const index = await loadProjectIndex(projectId);
  if (!index) throw new Error("Project not found");

  const loaded = (await loadScriptContents(projectId, index, 500)).find(
    (s) => s.scriptPath === scriptPath || s.logicalPath === scriptPath
  );

  const meta = index.testScripts.find(
    (s) => s.scriptPath === scriptPath || s.logicalPath === scriptPath
  );
  if (!meta) throw new Error(`Test script not found: ${scriptPath}`);

  if (!loaded) {
    return {
      fix: {
        scriptPath: meta.scriptPath,
        logicalPath: meta.logicalPath,
        original: "",
        fixed: "",
        diffSummary: ["Source file not on disk — re-upload project archive"],
        explanations: analyzeScriptContent("", meta, index).map((i) => ({
          ruleId: i.ruleId,
          severity: i.severity,
          confidence: i.confidence,
          reason: i.message,
        })),
        changed: false,
      },
      issues: analyzeScriptContent("", meta, index),
    };
  }

  const fix = fixScript(loaded, index);
  const issues = analyzeScriptContent(loaded.content, meta, index);

  return {
    fix,
    issues: issues.map((i) => ({
      ruleId: i.ruleId,
      severity: i.severity,
      message: i.message,
      confidence: i.confidence,
    })),
  };
}

export async function healProjectLocator(
  projectId: string,
  orPath: string,
  pageUrl?: string
): Promise<LocatorHealItemResult> {
  const index = await loadProjectIndex(projectId);
  if (!index) throw new Error("Project not found");

  const obj = index.testObjects.find((o) => o.path === orPath);
  if (!obj) throw new Error(`Object Repository item not found: ${orPath}`);

  const graph = buildProjectGraphV2(index);
  const impacted = findImpactedTests(graph, orPath).map((id) => id.replace(/^script:/, ""));

  const warnings: string[] = [];
  const quality = scoreOrObject(obj);
  let newLocator = proposeBetterSelector(obj);
  let reason = newLocator
    ? `Upgraded selector (${quality.issues.join("; ") || "higher stability score"})`
  : "Current selector is already optimal among indexed alternatives";

  const candidates: LocatorHealItemResult["candidates"] = [];

  const pushCandidate = (type: string, value: string, source: string) => {
    if (!value.trim()) return;
    candidates.push({
      type,
      value,
      score: scoreHealingCandidate(type as "id" | "name" | "css" | "xpath", value),
      source,
    });
  };

  pushCandidate(obj.selectorType, obj.selector, "current");
  for (const alt of obj.alternativeSelectors) {
    pushCandidate(alt.type, alt.value, "or_alternative");
  }

  const defaultUrl = await extractProjectDefaultUrl(projectId);
  const url = pageUrl?.trim() || defaultUrl || "";

  let playwrightUsed = false;
  if (url) {
    try {
      const failedType =
        obj.selectorType === "XPATH"
          ? "xpath"
          : obj.selectorType === "CSS"
            ? "css"
            : obj.selectorType === "NAME"
              ? "name"
              : "css";
      const fallbacks: FallbackLocator[] = await generateRuleBasedFallbacks({
        url,
        failedLocator: { type: failedType, value: obj.selector },
      });
      playwrightUsed = true;
      for (const f of fallbacks) {
        pushCandidate(f.type, f.value, f.source ?? "playwright");
        if (!newLocator || f.score > scoreHealingCandidate(newLocator.type as "id", newLocator.value)) {
          newLocator = { type: f.type, value: f.value };
          reason = `Playwright DOM analysis on ${url} — ${f.source ?? "rule"} candidate`;
        }
      }
    } catch (e) {
      warnings.push(
        e instanceof Error ? e.message : "Playwright healing skipped — using OR-only analysis"
      );
    }
  } else {
    warnings.push("No page URL — add one below or index a project with a default URL for Playwright healing");
  }

  if (!newLocator) {
    newLocator = { type: obj.selectorType, value: obj.selector };
    reason = "No better locator found — review candidates or provide a live page URL";
  }

  candidates.sort((a, b) => b.score - a.score);
  const unique = new Map<string, (typeof candidates)[0]>();
  for (const c of candidates) {
    const k = `${c.type}::${c.value}`;
    if (!unique.has(k) || (unique.get(k)?.score ?? 0) < c.score) unique.set(k, c);
  }

  const confidence = Math.min(
    0.98,
    (unique.get(`${newLocator.type}::${newLocator.value}`)?.score ?? 70) / 100
  );

  return {
    orPath: obj.path,
    label: obj.label,
    oldLocator: { type: obj.selectorType, value: obj.selector },
    newLocator,
    confidence,
    reason,
    impactedScripts: impacted,
    candidates: [...unique.values()].slice(0, 8),
    katalonSnippet: buildOrLocatorSnippet(newLocator.type, newLocator.value),
    rsPreview: buildRsSelectorHint(
      obj.selectorType,
      obj.selector,
      newLocator.type,
      newLocator.value
    ),
    playwrightUsed,
    warnings,
  };
}
