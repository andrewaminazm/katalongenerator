import type { GroovyUtilityIntent } from "../testDsl/groovyUtilityIntent.js";
import { inferMethodName, inferUtilityClassName } from "./groovyBestPractices.js";
import { defaultPackage, resolveUtilityImports } from "./groovyImportResolver.js";

export interface TemplateMatch {
  matched: boolean;
  className: string;
  methodName: string;
  imports: string[];
  bodyLines: string[];
  useKeyword?: boolean;
}

function wrapClass(
  className: string,
  imports: string[],
  methodName: string,
  params: string,
  bodyLines: string[],
  staticMethod = true
): string {
  const pkg = defaultPackage();
  const lines = [`package ${pkg}`, "", ...imports, "", `class ${className} {`, ""];
  const mod = staticMethod ? "static " : "";
  lines.push(`    ${mod}${methodName}${params} {`, "");
  for (const bl of bodyLines) {
    lines.push(bl ? `        ${bl}` : "");
  }
  lines.push("    }", "}", "");
  return lines.join("\n").trimEnd() + "\n";
}

export function matchDeterministicTemplate(intent: GroovyUtilityIntent): TemplateMatch | null {
  const subject = (intent.subject ?? "custom").toLowerCase();
  const haystack = `${subject} ${intent.raw}`.toLowerCase();

  if (/\b(random\s+)?email\b/.test(haystack)) {
    return {
      matched: true,
      className: "RandomDataUtils",
      methodName: "generateRandomEmail",
      imports: [],
      bodyLines: [
        'String timestamp = System.currentTimeMillis().toString()',
        'return "user_${timestamp}@example.com"',
      ],
    };
  }

  if (/\brandom\b/.test(haystack) && /\bname\b/.test(haystack)) {
    return {
      matched: true,
      className: "RandomDataUtils",
      methodName: "generateRandomName",
      imports: [],
      bodyLines: [
        "def firstNames = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Casey', 'Riley', 'Morgan', 'Avery']",
        "def lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Davis', 'Miller', 'Wilson']",
        "def rnd = new Random()",
        'return "${firstNames[rnd.nextInt(firstNames.size())]} ${lastNames[rnd.nextInt(lastNames.size())]}"',
      ],
    };
  }

  if (/\brandom\b/.test(haystack) && /\b(string|text|value|data)\b/.test(haystack)) {
    return {
      matched: true,
      className: "RandomDataUtils",
      methodName: "generateRandomString",
      imports: [],
      bodyLines: [
        "int len = (length != null && length > 0) ? length : 12",
        "def chars = ('A'..'Z') + ('a'..'z') + ('0'..'9')",
        "def rnd = new Random()",
        "return (1..len).collect { chars[rnd.nextInt(chars.size())] }.join('')",
      ],
    };
  }

  if (/\bretry\b/.test(haystack)) {
    return {
      matched: true,
      className: "RetryHelper",
      methodName: "retry",
      imports: [],
      bodyLines: [
        "int attempt = 0",
        "while (attempt < maxAttempts) {",
        "    try {",
        "        action.call()",
        "        return",
        "    } catch (Exception ex) {",
        "        attempt++",
        "        if (attempt >= maxAttempts) {",
        "            throw ex",
        "        }",
        "        Thread.sleep(delayMs)",
        "    }",
        "}",
      ],
    };
  }

  if (/\bdate\b|\bformat/.test(haystack)) {
    return {
      matched: true,
      className: "DateFormatter",
      methodName: "formatDate",
      imports: ["import java.text.SimpleDateFormat"],
      bodyLines: [
        'SimpleDateFormat sdf = new SimpleDateFormat(pattern ?: "yyyy-MM-dd HH:mm:ss")',
        "return sdf.format(date ?: new Date())",
      ],
    };
  }

  if (/\bscreenshot\b/.test(haystack) && intent.platform === "web") {
    const imports = resolveUtilityImports("web", { webui: true });
    return {
      matched: true,
      className: "ScreenshotHelper",
      methodName: "captureScreenshot",
      imports,
      bodyLines: [
        "String path = (fileName ?: 'screenshot') + '_' + System.currentTimeMillis() + '.png'",
        "WebUI.takeScreenshot(path)",
        "return path",
      ],
    };
  }

  if (/\b(api\s+)?token\b/.test(haystack) && intent.platform !== "utility") {
    const imports = resolveUtilityImports("api", { ws: true });
    return {
      matched: true,
      className: "ApiAuthHelper",
      methodName: "generateToken",
      imports,
      bodyLines: [
        "RequestObject request = findTestObject('API_Auth/Request_Token')",
        "def response = WS.sendRequest(request, FailureHandling.STOP_ON_FAILURE)",
        'return response.extractSOAPBodyAsContent()',
      ],
    };
  }

  if (/\bwait\b.*\bvisible\b/.test(haystack) && intent.platform === "web") {
    const imports = resolveUtilityImports("web", { webui: true, testObject: true });
    return {
      matched: true,
      className: "WaitHelper",
      methodName: "waitUntilVisible",
      imports,
      bodyLines: [
        "WebUI.waitForElementVisible(testObject, timeoutSeconds, FailureHandling.STOP_ON_FAILURE)",
      ],
    };
  }

  if (/\bencrypt/.test(haystack)) {
    return {
      matched: true,
      className: "EncryptionUtils",
      methodName: "encrypt",
      imports: [],
      bodyLines: [
        "if (plainText == null) return null",
        'return plainText.bytes.encodeBase64().toString()',
      ],
    };
  }

  if (/\bjson\b.*\bpars/.test(haystack) || /\bparser\b/.test(haystack)) {
    return {
      matched: true,
      className: "JsonParser",
      methodName: "parseJson",
      imports: ["import groovy.json.JsonSlurper"],
      bodyLines: [
        "if (!jsonText?.trim()) return null",
        "return new JsonSlurper().parseText(jsonText)",
      ],
    };
  }

  if (/\bexcel\b/.test(haystack)) {
    return {
      matched: true,
      className: "ExcelReader",
      methodName: "readExcel",
      imports: [],
      bodyLines: [
        "// Use Katalon built-in Excel keywords or Apache POI in Keywords folder",
        "throw new UnsupportedOperationException('Wire Excel path to your test data strategy')",
      ],
    };
  }

  if (/\bnormaliz/.test(haystack) && /\bstring\b/.test(haystack)) {
    return {
      matched: true,
      className: "StringNormalizer",
      methodName: "normalize",
      imports: [],
      bodyLines: [
        "if (value == null) return ''",
        "return value.trim().replaceAll(/\\\\s+/, ' ')",
      ],
    };
  }

  if (/\bfaker\b/.test(haystack)) {
    return {
      matched: true,
      className: "FakerDataUtils",
      methodName: "randomFullName",
      imports: [],
      bodyLines: [
        'return "User_${System.currentTimeMillis()}"',
      ],
    };
  }

  return null;
}

export function renderTemplate(match: TemplateMatch, intent: GroovyUtilityIntent): string {
  const params =
    match.methodName === "retry"
      ? "(int maxAttempts = 3, long delayMs = 1000, Closure action)"
      : match.methodName === "generateRandomEmail" || match.methodName === "generateRandomName"
        ? "()"
        : match.methodName === "generateRandomString"
          ? "(Integer length = null)"
          : match.methodName === "formatDate"
          ? "(Date date = null, String pattern = null)"
          : match.methodName === "captureScreenshot"
            ? "(String fileName = null)"
            : match.methodName === "generateToken"
              ? "(String username, String password)"
              : match.methodName === "waitUntilVisible"
                ? "(def testObject, int timeoutSeconds = 30)"
                : match.methodName === "encrypt"
                  ? "(String plainText)"
                  : match.methodName === "parseJson"
                    ? "(String jsonText)"
                    : match.methodName === "readExcel"
                      ? "(String filePath, String sheetName = 'Sheet1')"
                      : match.methodName === "normalize"
                        ? "(String value)"
                        : "()";

  return wrapClass(
    match.className,
    match.imports,
    match.methodName,
    params,
    match.bodyLines,
    true
  );
}

export function renderGenericUtility(intent: GroovyUtilityIntent): string {
  const className = inferUtilityClassName(intent.subject);
  const methodName = inferMethodName(intent.subject);
  const imports = resolveUtilityImports(intent.platform, {
    webui: intent.platform === "web",
    mobile: intent.platform === "mobile",
    ws: intent.platform === "api",
  });
  return wrapClass(className, imports, methodName, "()", [
    `// TODO: implement ${intent.subject}`,
    "throw new UnsupportedOperationException('Implement utility logic')",
  ]);
}
