import { parse } from "csv-parse/sync";

export interface ParsedCsvStep {
  stepNumber?: string;
  description: string;
}

/** One test case row from exports like VIC (Summary + Steps + …). */
export interface ParsedTestCaseRow {
  /** 1-based data row index in the parsed CSV (after header). */
  sourceRowIndex: number;
  testCaseId: string;
  title: string;
  stepLines: string[];
}

/**
 * Strip "| Expected: …" tail and split a Steps cell into numbered lines (1. … 2. …).
 */
export function expandStepsCell(stepsCell: string): string[] {
  const trimmed = stepsCell.trim();
  if (!trimmed) return [];
  const pipeIdx = trimmed.search(/\s*\|\s*Expected:/i);
  const main = (pipeIdx >= 0 ? trimmed.slice(0, pipeIdx) : trimmed).trim();
  if (!main) return [];
  const parts = main.split(/\s+(?=\d+\.\s)/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [main];
}

/**
 * Parses test-case style CSV with a **Steps** column (e.g. VIC / Zephyr exports).
 * Returns null if there is no Steps column — use {@link parseTestStepsCsv} instead.
 */
export function parseTestCaseCsvRows(csvText: string): ParsedTestCaseRow[] | null {
  const text = csvText.replace(/^\uFEFF/, "");
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];

  if (!records.length) return null;

  const keys = Object.keys(records[0]);
  const lower = new Map(keys.map((k) => [k.toLowerCase(), k]));
  const stepsKey = lower.get("steps");
  if (!stepsKey) return null;

  const summaryKey = lower.get("summary") ?? keys[0];
  const descKey = lower.get("description") ?? keys[1];

  const rows: ParsedTestCaseRow[] = [];
  let sourceRowIndex = 0;

  for (const row of records) {
    sourceRowIndex += 1;
    const summary = (row[summaryKey] ?? "").trim();
    const stepsCell = (row[stepsKey] ?? "").trim();
    if (!stepsCell) continue;
    if (/^test case id$/i.test(summary)) continue;
    if (
      /steps\s*\|\s*expected/i.test(stepsCell) &&
      /expected result/i.test(stepsCell)
    ) {
      continue;
    }

    const title = (row[descKey] ?? "").trim();
    const stepLines = expandStepsCell(stepsCell);
    if (!stepLines.length) continue;

    rows.push({
      sourceRowIndex,
      testCaseId: summary || `Row ${sourceRowIndex}`,
      title,
      stepLines,
    });
  }

  return rows.length ? rows : null;
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
