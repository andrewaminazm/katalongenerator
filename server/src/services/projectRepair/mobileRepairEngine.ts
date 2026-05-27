import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RepairSuggestion } from "./types.js";

export function analyzeMobileRepairs(scripts: LoadedScript[]): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];
  const mobileScripts = scripts.filter(
    (s) => /\bMobile\./.test(s.content) || /\/Mobile\//i.test(s.logicalPath)
  );

  for (const s of mobileScripts) {
    if (/\bWebUI\./.test(s.content)) {
      suggestions.push({
        id: `mobile-webui-${s.scriptPath}`,
        category: "mobile",
        severity: "high",
        confidence: 0.95,
        priority: 82,
        title: `WebUI usage in mobile script ${s.logicalPath}`,
        detail: "Mobile tests should use Mobile.* keywords only.",
        whyItMatters: "WebUI calls fail on Appium sessions.",
        affectedFiles: [s.scriptPath],
        suggestedFix: "Replace WebUI.* with Mobile.* equivalents.",
        autoApplicable: false,
      });
    }
    if (/\bThread\.sleep\s*\(/.test(s.content)) {
      suggestions.push({
        id: `mobile-sleep-${s.scriptPath}`,
        category: "mobile",
        severity: "high",
        confidence: 0.9,
        priority: 78,
        title: `Thread.sleep in mobile script`,
        detail: s.logicalPath,
        whyItMatters: "Hard sleeps are especially flaky on real devices.",
        affectedFiles: [s.scriptPath],
        suggestedFix: "Use Mobile.waitForElementPresent or Mobile.delay.",
        autoApplicable: true,
      });
    }
  }

  return suggestions;
}
