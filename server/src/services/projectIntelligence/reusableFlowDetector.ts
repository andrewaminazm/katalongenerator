import type { ParsedTestScript, ReusableFlow } from "./types.js";

const LOGIN_PATTERNS = [/login/i, /sign\s*in/i, /authenticate/i];
const NAV_PATTERNS = [/dashboard/i, /home\s*page/i, /navigate/i];

/**
 * Detect repeated flows from indexed test script keyword/OR usage (heuristic).
 */
export function detectReusableFlows(testScripts: ParsedTestScript[]): ReusableFlow[] {
  const flows: ReusableFlow[] = [];
  let loginCount = 0;
  const loginKeywords = new Set<string>();
  const loginOr = new Set<string>();

  for (const script of testScripts) {
    const blob = [
      ...script.customKeywordRefs,
      ...script.findTestObjectRefs,
      ...script.stepComments,
      script.logicalPath,
      script.displayName,
    ].join(" ");
    if (LOGIN_PATTERNS.some((p) => p.test(blob))) {
      loginCount++;
      for (const k of script.customKeywordRefs) {
        if (/login|sign/i.test(k)) loginKeywords.add(k);
      }
      for (const o of script.findTestObjectRefs) {
        if (/login|sign/i.test(o)) loginOr.add(o);
      }
    }
  }

  if (loginCount >= 2) {
    flows.push({
      id: "flow-login",
      name: "Application login",
      description: "Reusable login pattern detected across multiple test scripts",
      stepPattern: ["Open application", "Enter credentials", "Submit login"],
      confidence: Math.min(0.95, 0.5 + loginCount * 0.1),
      relatedKeywords: [...loginKeywords],
      relatedOrPaths: [...loginOr],
    });
  }

  let navCount = 0;
  for (const script of testScripts) {
    const blob = [...script.stepComments, script.logicalPath].join(" ");
    if (NAV_PATTERNS.some((p) => p.test(blob))) navCount++;
  }
  if (navCount >= 2) {
    flows.push({
      id: "flow-nav",
      name: "Navigation",
      description: "Common navigation steps across test scripts",
      stepPattern: ["Navigate to section"],
      confidence: 0.55,
      relatedKeywords: [],
      relatedOrPaths: [],
    });
  }

  return flows;
}
