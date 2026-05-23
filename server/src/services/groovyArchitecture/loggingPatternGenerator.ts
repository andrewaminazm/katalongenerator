export function loggingImports(): string[] {
  return ["import com.kms.katalon.core.util.KeywordUtil"];
}

export function logInfo(line: string, indent = "        "): string {
  return `${indent}KeywordUtil.logInfo("${line.replace(/"/g, '\\"')}")`;
}

export function logError(exVar = "ex", indent = "        "): string {
  return `${indent}KeywordUtil.logInfo("Error: " + ${exVar}.message)`;
}
