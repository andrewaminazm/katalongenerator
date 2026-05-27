import { inferModule } from "../coverageAnalyzer/scriptCoverageAnalyzer.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RepairSuggestion, RiskArea } from "./types.js";

export function analyzeRisks(
  index: ProjectIndex,
  scripts: LoadedScript[],
  suggestions: RepairSuggestion[]
): RiskArea[] {
  const byModule = new Map<string, { risk: number; reasons: string[] }>();

  for (const s of scripts) {
    const mod = inferModule(s.logicalPath);
    const entry = byModule.get(mod) ?? { risk: 0, reasons: [] };
    if (/\bThread\.sleep\s*\(/.test(s.content)) {
      entry.risk += 25;
      entry.reasons.push("Thread.sleep");
    }
    if ((s.content.match(/\bWebUI\.click\s*\(/gi) ?? []).length > 2) {
      entry.risk += 10;
      entry.reasons.push("Heavy click actions");
    }
    byModule.set(mod, entry);
  }

  for (const sug of suggestions.filter((s) => s.severity === "critical" || s.severity === "high")) {
    for (const f of sug.affectedFiles) {
      const mod = inferModule(f);
      const entry = byModule.get(mod) ?? { risk: 0, reasons: [] };
      entry.risk += 15;
      entry.reasons.push(sug.title.slice(0, 40));
      byModule.set(mod, entry);
    }
  }

  const flakyFromIndex = index.testScripts
    .filter((t) => t.semanticSummary.toLowerCase().includes("wait"))
    .slice(0, 5);

  for (const t of flakyFromIndex) {
    const mod = inferModule(t.logicalPath);
    const entry = byModule.get(mod) ?? { risk: 0, reasons: [] };
    entry.risk += 12;
    byModule.set(mod, entry);
  }

  return [...byModule.entries()]
    .map(([module, data]) => ({
      module,
      riskScore: Math.min(100, data.risk),
      reasons: [...new Set(data.reasons)].slice(0, 5),
      repairPriority: Math.min(100, data.risk + suggestions.filter((s) => s.affectedFiles.some((f) => inferModule(f) === module)).length * 5),
    }))
    .filter((r) => r.riskScore >= 20)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 12);
}
