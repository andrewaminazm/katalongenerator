export interface ConsoleAnalysis {
  browserErrors: string[];
  networkErrors: string[];
  jsErrors: string[];
  score: number;
}

export function analyzeConsoleLogs(consoleLogs: string): ConsoleAnalysis {
  const lines = consoleLogs.split(/\r?\n/).filter(Boolean);
  const browserErrors: string[] = [];
  const networkErrors: string[] = [];
  const jsErrors: string[] = [];

  for (const line of lines) {
    const l = line.toLowerCase();
    if (/failed to load|net::err|network error|cors|404|500/.test(l)) {
      networkErrors.push(line.trim());
    } else if (/uncaught|typeerror|referenceerror|syntaxerror|console\.error/.test(l)) {
      jsErrors.push(line.trim());
    } else if (/error|exception|severe/.test(l)) {
      browserErrors.push(line.trim());
    }
  }

  const score = Math.min(1, (networkErrors.length * 0.2 + jsErrors.length * 0.25 + browserErrors.length * 0.15));

  return {
    browserErrors: browserErrors.slice(0, 8),
    networkErrors: networkErrors.slice(0, 8),
    jsErrors: jsErrors.slice(0, 8),
    score,
  };
}
