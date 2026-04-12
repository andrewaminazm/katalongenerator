import { parse } from "csv-parse/sync";

export interface ParsedCsvStep {
  stepNumber?: string;
  description: string;
}

/**
 * Parses CSV with expected columns Step, Description (case-insensitive headers).
 * Falls back to first two columns if headers differ.
 */
export function parseTestStepsCsv(csvText: string): ParsedCsvStep[] {
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (!records.length) {
    return [];
  }

  const first = records[0];
  const keys = Object.keys(first);
  const lower = keys.map((k) => k.toLowerCase());

  let stepCol = keys.find((_, i) => lower[i] === "step");
  let descCol = keys.find((_, i) => lower[i] === "description");

  if (!descCol) {
    descCol = keys.find((_, i) =>
      ["desc", "detail", "action", "test step"].includes(lower[i])
    );
  }
  if (!stepCol && keys.length >= 2) stepCol = keys[0];
  if (!descCol && keys.length >= 2) descCol = keys[1];
  if (!descCol && keys.length === 1) descCol = keys[0];

  const out: ParsedCsvStep[] = [];

  for (const row of records) {
    const stepNum = stepCol ? row[stepCol]?.trim() : "";
    const description = (descCol ? row[descCol] : Object.values(row)[0])?.trim() ?? "";
    if (!description) continue;
    out.push({
      stepNumber: stepNum || undefined,
      description,
    });
  }

  return out;
}

export function parsedStepsToStrings(rows: ParsedCsvStep[]): string[] {
  return rows.map((r) =>
    r.stepNumber ? `${r.stepNumber}. ${r.description}` : r.description
  );
}
