import type { GroovyUtilityIntent } from "../testDsl/groovyUtilityIntent.js";
import { inferMethodName, inferUtilityClassName } from "./groovyBestPractices.js";
import { defaultPackage } from "./groovyImportResolver.js";

export function formatGroovyUtility(code: string): string {
  return code.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export function buildUtilityMetadata(intent: GroovyUtilityIntent, className: string, methodName: string) {
  return {
    className,
    methodName,
    platform: intent.platform,
    kind: intent.kind,
    confidence: intent.confidence,
    subject: intent.subject,
  };
}

export function mergeHybridOutput(utilityCode: string, testCode: string): string {
  const u = utilityCode.trimEnd();
  const t = testCode.trimEnd();
  return `${u}\n\n// --- Generated test script (hybrid mode) ---\n\n${t}\n`;
}

export { inferUtilityClassName, inferMethodName, defaultPackage };
