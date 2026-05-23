import type { AssertionStyleProfile } from "./types.js";
import type { ParsedTestScript } from "../projectIntelligence/types.js";

const VERIFY_RE =
  /\b(WebUI|Mobile|WS)\.(verify\w+|check\w+)\s*\(/gi;
const CUSTOM_VERIFY_RE = /CustomKeywords\s*\.\s*'[^']*\.(verify\w+|assert\w+|check\w+)'/gi;

export function analyzeAssertionPatterns(testScripts: ParsedTestScript[]): AssertionStyleProfile {
  const webUiVerifyCalls: Record<string, number> = {};
  const customVerifyKeywords: Record<string, number> = {};
  let softHint = 0;

  for (const script of testScripts) {
    const blob = script.webUiCalls.join("\n");
    for (const m of blob.matchAll(VERIFY_RE)) {
      const key = `${m[1]}.${m[2]}`;
      webUiVerifyCalls[key] = (webUiVerifyCalls[key] ?? 0) + 1;
    }
    for (const ref of script.customKeywordRefs) {
      if (/verify|assert|check/i.test(ref)) {
        customVerifyKeywords[ref] = (customVerifyKeywords[ref] ?? 0) + 1;
      }
    }
    if (/soft\s*assert|verifyMatch|verifyNotMatch/i.test(blob)) softHint++;
  }

  const webKeys = Object.keys(webUiVerifyCalls).sort(
    (a, b) => (webUiVerifyCalls[b] ?? 0) - (webUiVerifyCalls[a] ?? 0)
  );
  const customKeys = Object.keys(customVerifyKeywords).sort(
    (a, b) => (customVerifyKeywords[b] ?? 0) - (customVerifyKeywords[a] ?? 0)
  );

  const webTotal = Object.values(webUiVerifyCalls).reduce((a, b) => a + b, 0);
  const customTotal = Object.values(customVerifyKeywords).reduce((a, b) => a + b, 0);

  let dominant: AssertionStyleProfile["dominantPattern"] = "mixed";
  if (webTotal > customTotal * 2) dominant = "webui_verify";
  else if (customTotal > webTotal * 2) dominant = "custom_keyword";

  return {
    webUiVerifyCalls: webKeys.slice(0, 12),
    customVerifyKeywords: customKeys.slice(0, 12),
    prefersSoftAssertions: softHint >= 2,
    dominantPattern: dominant,
  };
}
