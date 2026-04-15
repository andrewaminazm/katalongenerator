import { stripPlaywrightLeakageFromGroovy } from "./locatorPipeline/autoFixLocatorEngine.js";

export type LintSeverity = "error" | "warning" | "info";

export interface LintIssue {
  rule: string;
  severity: LintSeverity;
  line?: number;
  message: string;
}

const RAW_SELENIUM =
  /\b(WebDriver|RemoteWebDriver|JavascriptExecutor|ChromeDriver|FirefoxDriver|EdgeDriver|By\.|ExpectedConditions|WebDriverWait\s*\(|\.findElement\s*\(|\.findElements\s*\()/;

/** Imports the LLM sometimes emits; they do not resolve in Katalon Studio. */
const BAD_WEB_IMPORT_LINE =
  /^\s*import\s+.*(WebDriver\.LocationType|LocationType\.FRAMENAME|\.LocationType\b|org\.openqa\.selenium\.WebDriver\s*$)/i;

export interface GroovyLintOptions {
  platform?: "web" | "mobile";
}

export function lintGroovy(
  code: string,
  knownOrPaths: Set<string>,
  options?: GroovyLintOptions
): LintIssue[] {
  const issues: LintIssue[] = [];
  const lines = code.split(/\r?\n/);

  lines.forEach((line, i) => {
    const n = i + 1;
    if (RAW_SELENIUM.test(line)) {
      issues.push({
        rule: "no-raw-selenium",
        severity: "error",
        line: n,
        message: "Avoid raw Selenium / WebDriver APIs — use Katalon keywords only.",
      });
    }
    if (options?.platform === "web" && BAD_WEB_IMPORT_LINE.test(line)) {
      issues.push({
        rule: "invalid-selenium-import",
        severity: "error",
        line: n,
        message:
          "Remove invalid Selenium imports (e.g. WebDriver.LocationType / FRAMENAME). Use Katalon WebUI keywords only — never import WebDriver inner types.",
      });
    }
    if (options?.platform !== "mobile" && /WebUI\.waitforElementVisible\b/.test(line)) {
      issues.push({
        rule: "webui-wait-typo",
        severity: "error",
        line: n,
        message:
          "Typo: use WebUI.waitForElementVisible (capital F) — waitforElementVisible is not a valid Katalon keyword.",
      });
    }
  });

  if (options?.platform === "mobile" && /Mobile\.openBrowser\s*\(/i.test(code)) {
    const idx = lines.findIndex((l) => /Mobile\.openBrowser\s*\(/i.test(l));
    issues.push({
      rule: "mobile-openBrowser-review",
      severity: "warning",
      line: idx >= 0 ? idx + 1 : undefined,
      message:
        "Mobile.openBrowser() is for mobile web. Native/hybrid flows (login, service list, Superapp) usually need Mobile.startExistingApplication / startApplication — confirm this matches your steps.",
    });
  }

  if (/^\s*import\s+/m.test(code)) {
    issues.push({
      rule: "top-level-imports",
      severity: "info",
      message:
        "Web scripts should keep the mandatory Katalon import block (TestObject, WebUI, etc.). Remove only unused non-Katalon imports if Studio warns.",
    });
  }

  if (knownOrPaths.size > 0) {
    const re = /findTestObject\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
    for (const m of code.matchAll(re)) {
      const path = m[1];
      if (!knownOrPaths.has(path)) {
        const lineNum = code.slice(0, m.index ?? 0).split(/\r?\n/).length;
        issues.push({
          rule: "unknown-findTestObject",
          severity: "warning",
          line: lineNum,
          message: `findTestObject('${path}') is not in the known Object Repository path list (upload / XML / locators).`,
        });
      }
    }
  }

  if (/\n{5,}/.test(code)) {
    issues.push({
      rule: "formatting",
      severity: "info",
      message: "Many consecutive blank lines — consider tightening layout.",
    });
  }

  return issues;
}

/** Light formatting pass (no AST). */
export function simplifyGroovyFormatting(code: string): string {
  return code.replace(/\n{4,}/g, "\n\n\n").trimEnd() + (code.trim() ? "\n" : "");
}

const WEBUI_OPEN_BROWSER = "WebUI.openBrowser";

/** User-preferred order; post-processor rewrites the script to match. */
const IMPORT_FAILURE_HANDLING = "import com.kms.katalon.core.model.FailureHandling";
const IMPORT_WEBUI = "import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI";
const IMPORT_TEST_OBJECT = "import com.kms.katalon.core.testobject.TestObject";
const IMPORT_CONDITION_TYPE = "import com.kms.katalon.core.testobject.ConditionType";
const IMPORT_FIND_TEST_OBJECT_STATIC =
  "import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject";
const IMPORT_KEYS = "import org.openqa.selenium.Keys";

const ALL_KNOWN_WEB_IMPORT_PREFIXES = [
  IMPORT_FAILURE_HANDLING,
  IMPORT_WEBUI,
  IMPORT_TEST_OBJECT,
  IMPORT_CONDITION_TYPE,
  IMPORT_FIND_TEST_OBJECT_STATIC,
  IMPORT_KEYS,
] as const;

function normImp(s: string): string {
  return s.trim().replace(/;$/, "");
}

/** Canonical import block: FailureHandling → WebUI → TestObject → ConditionType → [findTestObject static if used] → Keys. */
export function buildWebKatalonImportLines(code: string): string[] {
  const lines = [
    IMPORT_FAILURE_HANDLING,
    IMPORT_WEBUI,
    IMPORT_TEST_OBJECT,
    IMPORT_CONDITION_TYPE,
  ];
  if (/\bfindTestObject\s*\(/.test(code)) {
    lines.push(IMPORT_FIND_TEST_OBJECT_STATIC);
  }
  lines.push(IMPORT_KEYS);
  return lines;
}

function isBadKatalonWebImportLine(line: string): boolean {
  if (!line.trim().startsWith("import")) return false;
  return BAD_WEB_IMPORT_LINE.test(line);
}

/** Removes hallucinated Selenium imports that fail compilation in Katalon Studio. */
export function stripBadKatalonWebImports(code: string): string {
  return code
    .split(/\r?\n/)
    .filter((l) => !isBadKatalonWebImportLine(l))
    .join("\n");
}

/**
 * Ensures mandatory Katalon WebUI/TestObject imports when the body uses WebUI / TestObject / etc.
 * Katalon compiles test scripts as plain Groovy — types are not implicit (unlike Script mode with default imports in some setups).
 * Drops any prior lines matching this block and re-inserts them in canonical order (avoids partial/duplicate imports).
 */
export function ensureWebKatalonImports(code: string): string {
  const body = code;
  const needsImports =
    /\bnew\s+TestObject\s*\(/.test(body) ||
    /\bTestObject\s+\w+\s*=/.test(body) ||
    /\bWebUI\./.test(body) ||
    /\bfindTestObject\s*\(/.test(body) ||
    /\bConditionType\./.test(body);
  if (!needsImports) {
    return code;
  }

  const canonicalSet = new Set(ALL_KNOWN_WEB_IMPORT_PREFIXES.map((s) => normImp(s)));
  const lines = code.split(/\r?\n/).filter((l) => {
    const g = normImp(l);
    return !(g.startsWith("import") && canonicalSet.has(g));
  });

  const textForFindTestObjectCheck = lines.join("\n");
  const block = buildWebKatalonImportLines(textForFindTestObjectCheck);

  let k = 0;
  while (k < lines.length && (/^\s*\/\//.test(lines[k]) || /^\s*$/.test(lines[k]))) {
    k++;
  }
  lines.splice(k, 0, ...block);
  return lines.join("\n");
}

/**
 * Full post-process for platform **web**: strip bad Selenium imports, ensure Katalon imports, fix openBrowser overload.
 */
export function normalizeKatalonWebGroovy(code: string): string {
  let c = stripBadKatalonWebImports(code);
  c = ensureWebKatalonImports(c);
  c = normalizeWebUIOpenBrowser(c);
  c = stripPlaywrightLeakageFromGroovy(c);
  return c;
}

/**
 * Katalon/Groovy can throw MethodSelectionException for WebUI.openBrowser(singleArg)
 * when it cannot choose between openBrowser(String) and openBrowser(String, FailureHandling).
 * Always use the two-argument form so resolution is unambiguous.
 */
export function normalizeWebUIOpenBrowser(code: string): string {
  if (!code.includes(WEBUI_OPEN_BROWSER)) {
    return code;
  }

  let result = "";
  let i = 0;
  while (i < code.length) {
    const idx = code.indexOf(WEBUI_OPEN_BROWSER, i);
    if (idx === -1) {
      result += code.slice(i);
      break;
    }
    result += code.slice(i, idx);
    const openParen = code.indexOf("(", idx + WEBUI_OPEN_BROWSER.length);
    if (openParen === -1) {
      result += code.slice(idx);
      break;
    }
    let depth = 0;
    let j = openParen;
    for (; j < code.length; j++) {
      const c = code[j];
      if (c === "(") depth++;
      else if (c === ")") {
        depth--;
        if (depth === 0) break;
      }
    }
    if (j >= code.length) {
      result += code.slice(idx);
      break;
    }
    const inner = code.slice(openParen + 1, j);
    const trimmed = inner.trim();
    if (/FailureHandling\./.test(trimmed)) {
      result += code.slice(idx, j + 1);
      i = j + 1;
      continue;
    }
    let parenDepth = 0;
    let topLevelCommas = 0;
    for (let k = 0; k < inner.length; k++) {
      const ch = inner[k];
      if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth--;
      else if (ch === "," && parenDepth === 0) topLevelCommas++;
    }
    if (topLevelCommas >= 1) {
      result += code.slice(idx, j + 1);
      i = j + 1;
      continue;
    }
    const arg = trimmed.length === 0 ? "''" : trimmed;
    result += `${WEBUI_OPEN_BROWSER}(${arg}, FailureHandling.STOP_ON_FAILURE)`;
    i = j + 1;
  }

  return ensureFailureHandlingImport(result);
}

function ensureFailureHandlingImport(code: string): string {
  if (!code.includes("FailureHandling.")) {
    return code;
  }
  if (/^\s*import\s+com\.kms\.katalon\.core\.model\.FailureHandling\b/m.test(code)) {
    return code;
  }
  const lines = code.split(/\r?\n/);
  const webUiIdx = lines.findIndex((l) =>
    /^\s*import\s+com\.kms\.katalon\.core\.webui\.keyword\.WebUiBuiltInKeywords\s+as\s+WebUI\s*;?\s*$/.test(l)
  );
  if (webUiIdx >= 0) {
    lines.splice(webUiIdx + 1, 0, "import com.kms.katalon.core.model.FailureHandling");
    return lines.join("\n");
  }
  const firstImportIdx = lines.findIndex((l) => /^\s*import\s/.test(l));
  if (firstImportIdx >= 0) {
    lines.splice(firstImportIdx, 0, "import com.kms.katalon.core.model.FailureHandling");
    return lines.join("\n");
  }
  return `import com.kms.katalon.core.model.FailureHandling\n${code}`;
}
