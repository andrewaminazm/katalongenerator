import type { WaitStrategyProfile, AntiPatternHint } from "./types.js";
import type { ParsedKeywordClass, ParsedTestScript } from "../projectIntelligence/types.js";

const WAIT_RE = /\b(WebUI|Mobile)\.(wait\w+)\s*\(/gi;

export function analyzeWaitStrategy(
  testScripts: ParsedTestScript[],
  keywords: ParsedKeywordClass[]
): WaitStrategyProfile {
  const webUiWaitCalls: Record<string, number> = {};
  const customWaitKeywords: Record<string, number> = {};

  for (const script of testScripts) {
    const blob = script.webUiCalls.join("\n");
    for (const m of blob.matchAll(WAIT_RE)) {
      const key = `${m[1]}.${m[2]}`;
      webUiWaitCalls[key] = (webUiWaitCalls[key] ?? 0) + 1;
    }
    for (const ref of script.customKeywordRefs) {
      if (/wait|sleep|delay/i.test(ref)) {
        customWaitKeywords[ref] = (customWaitKeywords[ref] ?? 0) + 1;
      }
    }
  }

  for (const kw of keywords) {
    for (const m of kw.methods) {
      if (/wait|sleep|delay|visible|present/i.test(m.name)) {
        customWaitKeywords[kw.customKeywordsPath] =
          (customWaitKeywords[kw.customKeywordsPath] ?? 0) + 5;
      }
    }
  }

  const webTotal = Object.values(webUiWaitCalls).reduce((a, b) => a + b, 0);
  const customTotal = Object.values(customWaitKeywords).reduce((a, b) => a + b, 0);

  let dominant: WaitStrategyProfile["dominantPattern"] = "mixed";
  if (webTotal > customTotal * 1.5) dominant = "webui_wait";
  else if (customTotal > webTotal * 1.5) dominant = "custom_wait";

  return {
    webUiWaitCalls,
    customWaitKeywords: Object.keys(customWaitKeywords)
      .sort((a, b) => (customWaitKeywords[b] ?? 0) - (customWaitKeywords[a] ?? 0))
      .slice(0, 12),
    dominantPattern: dominant,
    defaultWaitSeconds: 10,
  };
}

export function detectAntiPatterns(
  testScripts: ParsedTestScript[],
  keywordDrivenScore: number
): AntiPatternHint[] {
  const hints: AntiPatternHint[] = [];
  let waitHeavy = 0;
  let rawWebUi = 0;

  for (const script of testScripts) {
    const waits = (script.webUiCalls.join(" ").match(/waitFor/gi) ?? []).length;
    if (waits >= 5) waitHeavy++;
    if (script.webUiCalls.length > script.customKeywordRefs.length * 3) rawWebUi++;
  }

  if (waitHeavy >= 3) {
    hints.push({
      kind: "duplicate_wait",
      message:
        "Multiple scripts repeat many waitFor* calls — consider a shared WaitHelper keyword.",
      severity: "warning",
    });
  }
  if (keywordDrivenScore > 0.4 && rawWebUi >= 5) {
    hints.push({
      kind: "raw_webui_over_keyword",
      message:
        "Project has strong CustomKeywords usage but many scripts still call WebUI directly — prefer team keywords when generating new code.",
      severity: "info",
    });
  }

  const retryKeywords = testScripts.flatMap((s) => s.customKeywordRefs).filter((r) => /retry/i.test(r));
  if (retryKeywords.length >= 2) {
    hints.push({
      kind: "duplicate_retry",
      message: `Reuse existing retry helpers: ${[...new Set(retryKeywords)].slice(0, 3).join(", ")}`,
      severity: "info",
    });
  }

  return hints;
}

export function buildKeywordUsageProfile(
  testScripts: ParsedTestScript[],
  keywords: ParsedKeywordClass[]
): import("./types.js").KeywordUsageProfile[] {
  const counts = new Map<string, number>();
  const methodsByPath = new Map<string, Set<string>>();

  for (const script of testScripts) {
    for (const ref of script.customKeywordRefs) {
      counts.set(ref, (counts.get(ref) ?? 0) + 1);
      const method = ref.split(".").pop();
      if (method) {
        const set = methodsByPath.get(ref) ?? new Set();
        set.add(method);
        methodsByPath.set(ref, set);
      }
    }
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);

  if (ranked.length === 0) {
    return keywords.slice(0, 10).map((k) => ({
      path: k.customKeywordsPath,
      callCount: k.methods.length,
      methodNames: k.methods.slice(0, 8).map((m) => m.name),
    }));
  }

  return ranked.map(([path, callCount]) => ({
    path,
    callCount,
    methodNames: [...(methodsByPath.get(path) ?? [])].slice(0, 8),
  }));
}
