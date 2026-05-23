const RAW_FIND_ELEMENT = /\.findElement\s*\(|\.findElements\s*\(|driver\.findElement/i;

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

/** Same rules as playwrightActionParser stripLineComment — avoid false positives from // comments. */
function stripLineComment(line: string): string {
  const idx = line.indexOf("//");
  if (idx < 0) return line;
  const before = line.slice(0, idx);
  const inQuotes = (() => {
    let q: string | null = null;
    for (let i = 0; i < idx; i++) {
      const c = line[i];
      if (q) {
        if (c === "\\" && i + 1 < idx) continue;
        if (c === q) q = null;
        continue;
      }
      if (c === "'" || c === '"') q = c;
      if (c === "`") q = "`";
    }
    return q !== null;
  })();
  return inQuotes ? line : before.trimEnd();
}

/**
 * Strict gatekeeper before returning Groovy to clients.
 * Line comments are stripped before pattern checks so `// STRIPPED: ...page.findElement...` does not fail validation.
 */
export function validateKatalonGroovy(code: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const lines = code.split(/\r?\n/);
  const substantive = lines
    .map((line) => stripLineComment(line))
    .filter((line) => line.trim().length > 0);

  const body = substantive.join("\n");

  if (/@Test\b|org\.testng|junit\.framework|org\.junit/i.test(body)) {
    errors.push("Forbidden: TestNG/JUnit-style annotations or imports in script body.");
  }
  if (RAW_FIND_ELEMENT.test(body)) {
    errors.push("Forbidden: raw WebDriver findElement/findElements — use Katalon keywords.");
  }
  if (/\bwebUI\./.test(body)) {
    errors.push("Invalid: use WebUI with capital W (webUI detected).");
  }
  if (/import\s+org\.openqa\.selenium\.WebDriver\b/i.test(body)) {
    errors.push("Invalid: do not import org.openqa.selenium.WebDriver in generated scripts.");
  }
  if (/WebDriver\.LocationType|LocationType\.FRAMENAME/i.test(body)) {
    errors.push("Invalid: WebDriver.LocationType / FRAMENAME imports are not supported.");
  }

  return { errors, warnings };
}

/**
 * Validation for generated Custom Keyword class templates (not test-case scripts).
 */
export function validateKeywordTemplateGroovy(
  code: string,
  options?: { allowOpenBrowser?: boolean }
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const body = code.trim();
  if (!body) {
    errors.push("Keyword template is empty.");
    return { errors, warnings };
  }

  if (!/\bpackage\s+[\w.]+\b/.test(body)) {
    errors.push("Keyword template must declare a package.");
  }
  if (!/\bclass\s+[A-Z]\w*\b/.test(body)) {
    errors.push("Keyword template must declare a class.");
  }
  if (!/@Keyword\b/.test(body)) {
    errors.push("Keyword template must include at least one @Keyword method.");
  }
  if (/@Test\b|org\.testng|junit\.framework|org\.junit/i.test(body)) {
    errors.push("Forbidden: TestNG/JUnit in keyword class.");
  }
  if (RAW_FIND_ELEMENT.test(body)) {
    errors.push("Forbidden: raw WebDriver findElement — use findTestObject in keywords.");
  }
  if (
    !options?.allowOpenBrowser &&
    /\bWebUI\.openBrowser\s*\(/.test(body)
  ) {
    errors.push("Keyword templates must not call WebUI.openBrowser — use navigation keywords in test cases.");
  }
  if (/\bWebUI\.verifyTextPresent\s*\(\s*['"]{2}/.test(body)) {
    errors.push("Keyword templates must not emit empty verifyTextPresent.");
  }

  return { errors, warnings };
}
