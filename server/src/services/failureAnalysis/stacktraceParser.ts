export interface ParsedStacktrace {
  exceptionType: string;
  message: string;
  frames: string[];
  raw: string;
  katalonKeyword?: string;
  groovyFile?: string;
  lineNumber?: number;
  seleniumHints: string[];
  appiumHints: string[];
  katalonHints: string[];
}

const EXCEPTION_RE =
  /^([\w.$]+(?:Exception|Error|Failure|Timeout))(?:\s*:\s*(.*))?$/m;

export function parseStacktrace(stacktrace: string): ParsedStacktrace | null {
  const raw = stacktrace.trim();
  if (!raw) return null;

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const first = lines[0] ?? "";
  const exMatch = first.match(/^([\w.$]+(?:Exception|Error|Failure|Timeout))(?::\s*(.*))?$/);
  const exceptionType = exMatch?.[1] ?? "UnknownFailure";
  const message = exMatch?.[2]?.trim() || lines[1] || "";

  const frames = lines.filter((l) => /^\s*at\s+|^\s*Caused by:|^\.+in\s/.test(l) || l.includes(".groovy:"));

  let katalonKeyword: string | undefined;
  let groovyFile: string | undefined;
  let lineNumber: number | undefined;

  for (const line of lines) {
    const kw = line.match(/CustomKeywords\.'([^']+)'/);
    if (kw) katalonKeyword = kw[1];
    const groovy = line.match(/([\w/\\.-]+\.groovy):(\d+)/);
    if (groovy) {
      groovyFile = groovy[1];
      lineNumber = Number(groovy[2]);
    }
  }

  const blob = raw.toLowerCase();
  const seleniumHints: string[] = [];
  const appiumHints: string[] = [];
  const katalonHints: string[] = [];

  if (/nosuchelement|staleelement|elementnotinteractable|elementclickintercepted|timeoutexception/i.test(blob)) {
    seleniumHints.push("selenium_element");
  }
  if (/webdriver|chromedriver|geckodriver|session/i.test(blob)) {
    seleniumHints.push("webdriver_session");
  }
  if (/appium|instrumentation|adb|xcuitest|uiautomator|mobile\./i.test(blob)) {
    appiumHints.push("katalon_mobile");
  }
  if (/com\.kms\.katalon|findtestobject|customkeywords|webui\.|failurehandling|testobject/i.test(blob)) {
    katalonHints.push("katalon_runtime");
  }
  if (/keyword.*\.groovy|scripts\.|test case|test listener/i.test(blob)) {
    katalonHints.push("katalon_project");
  }

  return {
    exceptionType,
    message,
    frames,
    raw,
    katalonKeyword,
    groovyFile,
    lineNumber,
    seleniumHints,
    appiumHints,
    katalonHints,
  };
}

export function mergeTextSignals(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join("\n\n");
}
