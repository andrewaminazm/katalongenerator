import type { LoadedScript } from "../projectIntelligenceV2/sourceLoader.js";
import type { RepairSuggestion } from "./types.js";

export function analyzePerformanceRepairs(scripts: LoadedScript[]): RepairSuggestion[] {
  const suggestions: RepairSuggestion[] = [];
  const perfHints = scripts.filter(
    (s) =>
      /\.jmx|k6|load test|virtual users|throughput/i.test(s.content) ||
      /performance|jmeter/i.test(s.logicalPath)
  );

  if (perfHints.length === 0) return suggestions;

  for (const s of perfHints.slice(0, 10)) {
    if (!/threshold|SLA|p\(95\)|assert/i.test(s.content)) {
      suggestions.push({
        id: `perf-sla-${s.scriptPath}`,
        category: "performance",
        severity: "medium",
        confidence: 0.72,
        priority: 50,
        title: `Missing SLA/thresholds in ${s.logicalPath}`,
        detail: "No explicit performance thresholds found.",
        whyItMatters: "Load tests without SLAs cannot gate releases.",
        affectedFiles: [s.scriptPath],
        suggestedFix: "Add k6 thresholds or JMeter assertions for p95 latency.",
        autoApplicable: false,
      });
    }
  }

  return suggestions;
}
