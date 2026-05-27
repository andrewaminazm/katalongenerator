import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RepairSuggestion } from "./types.js";

const RAW_SELENIUM_IMPORT =
  /^\s*import\s+.*(org\.openqa\.selenium|WebDriver|ChromeDriver|By\.|ExpectedConditions)/i;

const BAD_IMPORT =
  /^\s*import\s+.*(WebDriver\.LocationType|LocationType\.FRAMENAME)/i;

export function analyzeImports(scripts: LoadedScript[]): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];

  for (const s of scripts) {
    const lines = s.content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (RAW_SELENIUM_IMPORT.test(line) || BAD_IMPORT.test(line)) {
        suggestions.push({
          id: `import-selenium-${s.scriptPath}-${idx}`,
          category: "import",
          severity: "high",
          confidence: 0.95,
          priority: 85,
          title: `Invalid Selenium import in ${s.logicalPath}`,
          detail: `Line ${idx + 1}: ${line.trim()}`,
          whyItMatters: "Raw Selenium imports break in Katalon Studio — use WebUI/Mobile/WS built-ins.",
          affectedFiles: [s.scriptPath],
          suggestedFix: "Remove the import; use com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI",
          autoApplicable: true,
          beforeExample: line.trim(),
          afterExample: "// removed — use WebUI.* keywords",
        });
      }
    });

    const imports = lines.filter((l) => /^\s*import\s+/.test(l));
    const dup = imports.filter((v, i, a) => a.indexOf(v) !== i);
    if (dup.length > 0) {
      suggestions.push({
        id: `import-dup-${s.scriptPath}`,
        category: "import",
        severity: "low",
        confidence: 0.9,
        priority: 40,
        title: `Duplicate imports in ${s.logicalPath}`,
        detail: `${dup.length} duplicate import line(s).`,
        whyItMatters: "Duplicate imports add noise and slow Studio parsing.",
        affectedFiles: [s.scriptPath],
        suggestedFix: "Deduplicate and sort imports (Katalon canonical order).",
        autoApplicable: true,
      });
    }
  }

  return suggestions;
}

export function repairImports(content: string): string {
  const lines = content.split(/\r?\n/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    if (/^\s*import\s+/.test(line)) {
      const key = line.trim();
      if (RAW_SELENIUM_IMPORT.test(line) || BAD_IMPORT.test(line)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(line);
  }
  return out.join("\n");
}
