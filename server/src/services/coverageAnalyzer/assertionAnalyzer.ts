import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { WeakAssertionFinding } from "./types.js";

const VERIFY_PATTERNS = [
  /\bWebUI\.verify\w*\s*\(/gi,
  /\bWS\.verifyResponseStatusCode\s*\(/gi,
  /\bWS\.verifyElementPropertyValue\s*\(/gi,
  /\bMobile\.verify\w*\s*\(/gi,
  /\bverify\s+/gi,
  /\bassert\w*\s*\(/gi,
];

const ACTION_PATTERNS = [
  /\bWebUI\.(click|setText|selectOption|check|uncheck|sendKeys|tap|swipe)\s*\(/gi,
  /\bMobile\.(tap|setText|swipe)\s*\(/gi,
  /\bWS\.sendRequest\s*\(/gi,
  /\bCustomKeywords\./gi,
];

function countMatches(content: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) {
    const re = new RegExp(p.source, p.flags);
    n += (content.match(re) ?? []).length;
  }
  return n;
}

export function analyzeAssertions(scripts: LoadedScript[]): {
  findings: WeakAssertionFinding[];
  averageAssertionRatio: number;
} {
  const findings: WeakAssertionFinding[] = [];
  let totalRatio = 0;
  let counted = 0;

  for (const s of scripts) {
    const actions = countMatches(s.content, ACTION_PATTERNS);
    const verifies = countMatches(s.content, VERIFY_PATTERNS);
    const total = actions + verifies;
    const ratio = total > 0 ? verifies / total : verifies > 0 ? 1 : 0;
    totalRatio += ratio;
    counted += 1;

    if (actions >= 3 && verifies === 0) {
      findings.push({
        scriptPath: s.scriptPath,
        logicalPath: s.logicalPath,
        actionCount: actions,
        verifyCount: verifies,
        reason: "Action-heavy script with no verify/assert calls detected",
      });
    } else if (actions >= 5 && ratio < 0.15) {
      findings.push({
        scriptPath: s.scriptPath,
        logicalPath: s.logicalPath,
        actionCount: actions,
        verifyCount: verifies,
        reason: `Low validation density (${Math.round(ratio * 100)}% verify vs actions)`,
      });
    }
  }

  return {
    findings,
    averageAssertionRatio: counted ? totalRatio / counted : 0,
  };
}
