export interface ConfidenceInput {
  hasStacktrace: boolean;
  hasLogs: boolean;
  hasConsole: boolean;
  hasApi: boolean;
  hasScreenshot: boolean;
  analyzerScores: number[];
  signalAgreement: number;
  aiEnhanced: boolean;
  logOnlyMode?: boolean;
  katalonParseConfidence?: number;
  inferenceConfidence?: number;
  patternCount?: number;
}

export function scoreConfidence(input: ConfidenceInput): {
  rootCauseConfidence: number;
  suggestedFixConfidence: number;
  notes: string[];
} {
  const notes: string[] = [];
  let base = 0.35;

  const logOnly = Boolean(input.logOnlyMode);
  const katalonParse = input.katalonParseConfidence ?? 0;

  if (logOnly && katalonParse >= 0.55) {
    base = 0.5 + katalonParse * 0.35;
    if (input.inferenceConfidence) {
      base = base * 0.5 + input.inferenceConfidence * 0.5;
    }
    if ((input.patternCount ?? 0) > 0) {
      base += 0.05;
    }
    notes.push("Log-only analysis mode — inferred from Katalon execution log patterns.");
  } else {
    if (input.hasStacktrace) base += 0.2;
    else if (!logOnly) notes.push("No stacktrace provided — confidence reduced.");

    if (input.hasLogs) base += 0.12;
    if (input.hasConsole) base += 0.06;
    if (input.hasApi) base += 0.08;
    if (input.hasScreenshot) base += 0.05;
  }

  const maxAnalyzer = input.analyzerScores.length ? Math.max(...input.analyzerScores) : 0;
  base += maxAnalyzer * 0.2;
  base += input.signalAgreement * 0.12;

  if (input.aiEnhanced) base += 0.04;

  const rootCauseConfidence = Math.min(0.98, Math.max(0.28, base));
  let suggestedFixConfidence = rootCauseConfidence * 0.92;
  if (input.patternCount && input.patternCount > 0) {
    suggestedFixConfidence = Math.min(0.96, suggestedFixConfidence + 0.06);
  }

  if (rootCauseConfidence < 0.55 && !logOnly) {
    notes.push("Paste Katalon execution logs for stronger log-only inference (stacktrace optional).");
  }

  return {
    rootCauseConfidence: Math.round(rootCauseConfidence * 100) / 100,
    suggestedFixConfidence: Math.round(suggestedFixConfidence * 100) / 100,
    notes,
  };
}
