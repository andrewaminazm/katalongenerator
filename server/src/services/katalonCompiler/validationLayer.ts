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
