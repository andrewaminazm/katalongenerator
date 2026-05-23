import type { FrameworkArchitectureProfile } from "./types.js";
import type { ParsedKeywordClass, ParsedTestScript } from "../projectIntelligence/types.js";

export function analyzeFrameworkArchitecture(
  keywords: ParsedKeywordClass[],
  testScripts: ParsedTestScript[]
): FrameworkArchitectureProfile {
  const baseClassHints: string[] = [];
  const utilityClassHints: string[] = [];
  const pageObjectHints: string[] = [];

  for (const k of keywords) {
    const cn = k.className;
    if (/BaseTest|TestBase|BaseCase/i.test(cn)) baseClassHints.push(k.customKeywordsPath);
    if (/Utils?|Helper|Manager|Service|Actions/i.test(cn)) utilityClassHints.push(k.customKeywordsPath);
    if (/Page$/i.test(cn) || /Page\w+/i.test(cn)) pageObjectHints.push(k.customKeywordsPath);
  }

  const includeCount = testScripts.filter((s) => s.kind === "include" || s.kind === "lib").length;
  const keywordRefs = testScripts.reduce((n, s) => n + s.customKeywordRefs.length, 0);
  const webUiCalls = testScripts.reduce((n, s) => n + s.webUiCalls.length, 0);
  const keywordDrivenScore =
    webUiCalls > 0 ? Math.min(1, keywordRefs / (keywordRefs + webUiCalls)) : keywordRefs > 0 ? 1 : 0;

  return {
    hasBaseTestPattern: baseClassHints.length > 0,
    baseClassHints: baseClassHints.slice(0, 8),
    utilityClassHints: utilityClassHints.slice(0, 15),
    pageObjectHints: pageObjectHints.slice(0, 12),
    keywordDrivenScore,
    includeScriptCount: includeCount,
  };
}
