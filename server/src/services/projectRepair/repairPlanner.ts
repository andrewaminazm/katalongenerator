import type { RepairSuggestion } from "./types.js";

export function planRepairs(suggestions: RepairSuggestion[]): RepairSuggestion[] {
  return [...suggestions]
    .sort((a, b) => b.priority - a.priority || b.confidence - a.confidence)
    .slice(0, 120);
}

export function filterApplicable(
  suggestions: RepairSuggestion[],
  suggestionIds?: string[]
): RepairSuggestion[] {
  if (suggestionIds && suggestionIds.length > 0) {
    const set = new Set(suggestionIds);
    return suggestions.filter((s) => set.has(s.id));
  }
  return suggestions.filter((s) => s.autoApplicable);
}
