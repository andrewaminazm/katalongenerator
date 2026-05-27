import type { RepairDiff } from "./types.js";

export function summarizeDiff(original: string, repaired: string, max = 12): string[] {
  const oLines = original.split(/\r?\n/);
  const fLines = repaired.split(/\r?\n/);
  const summary: string[] = [];
  const maxLen = Math.max(oLines.length, fLines.length);
  let changes = 0;
  for (let i = 0; i < maxLen && changes < max; i++) {
    if (oLines[i] !== fLines[i]) {
      summary.push(`Line ${i + 1}: updated`);
      changes++;
    }
  }
  if (changes === 0) summary.push("No line changes");
  if (changes >= max) summary.push(`… and more (${maxLen} lines total)`);
  return summary;
}

export function buildRepairDiff(input: {
  filePath: string;
  category: RepairDiff["category"];
  suggestionId: string;
  original: string;
  repaired: string;
  lintWarnings?: string[];
}): RepairDiff {
  const changed = input.original !== input.repaired;
  const lintWarnings = input.lintWarnings ?? [];
  return {
    filePath: input.filePath,
    category: input.category,
    suggestionId: input.suggestionId,
    original: input.original,
    repaired: input.repaired,
    diffSummary: summarizeDiff(input.original, input.repaired),
    changed,
    lintPassed: lintWarnings.filter((w) => w.includes("error")).length === 0,
    lintWarnings,
  };
}
