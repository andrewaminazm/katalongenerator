import type { ValidationResult } from "../katalonCompiler/validationLayer.js";

const FORBIDDEN_PATTERNS: { re: RegExp; message: string }[] = [
  { re: /\bRuntime\.getRuntime\s*\(\s*\)\.exec\b/i, message: "Forbidden: Runtime.exec" },
  { re: /\bProcessBuilder\s*\(/i, message: "Forbidden: ProcessBuilder" },
  { re: /\bnew\s+Process\s*\(/i, message: "Forbidden: Process construction" },
  {
    re: /\b(?:rm\s+-rf|del\s+\/s|format\s+c:|drop\s+table|shutdown\s+-)/i,
    message: "Forbidden: destructive shell-style commands",
  },
  { re: /\b(?:steal|exfiltrat|keylog)/i, message: "Forbidden: malicious behavior pattern" },
  { re: /@Test\b|org\.testng|junit\.framework/i, message: "Forbidden: test framework markers in utility code" },
  { re: /\.findElement\s*\(/i, message: "Forbidden: raw findElement — use Katalon keywords" },
];

export function validateGroovyUtilityAst(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const body = code.trim();

  if (!body) {
    errors.push("Generated Groovy is empty.");
    return { errors, warnings };
  }

  if (!/\bclass\s+[A-Z]\w*/.test(body)) {
    errors.push("Utility output must declare a class.");
  }

  for (const { re, message } of FORBIDDEN_PATTERNS) {
    if (re.test(body)) errors.push(message);
  }

  if (/\bWebUI\.openBrowser\s*\(/.test(body) && !/\bBrowserManager\b/i.test(body)) {
    warnings.push("WebUI.openBrowser in utilities is unusual — prefer a BrowserManager helper.");
  }

  return { errors, warnings };
}

/** Strip markdown fences and leading commentary from model output */
export function extractGroovyFromModelResponse(text: string): string {
  let s = text.trim();
  const fence = s.match(/```(?:groovy|java)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) s = fence[1].trim();
  s = s.replace(/^#+\s+.*$/gm, "").trim();
  const classIdx = s.search(/\b(package\s+|class\s+)/);
  if (classIdx > 0) s = s.slice(classIdx);
  return s.trim();
}
