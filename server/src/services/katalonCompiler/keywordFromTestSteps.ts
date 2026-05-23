import type { CreateKeywordIntent, KeywordTemplatePlatform } from "../testDsl/keywordCreateIntent.js";
import { detectKeywordTemplatePlatform } from "../testDsl/keywordCreateIntent.js";
import {
  inferKeywordClassName,
  inferKeywordMethodName,
  KEYWORD_TEMPLATE_MODEL_ID,
} from "./keywordTemplateGenerator.js";
import { compileKatalonScript } from "./index.js";
import type { CompileKatalonInput } from "./types.js";
import { validateKeywordTemplateGroovy } from "./validationLayer.js";

function capitalize(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Infer keyword topic from test case name or step text (URLs, visit targets). */
export function inferKeywordSubjectFromSteps(steps: string[], testCaseName?: string): string {
  const tc = testCaseName?.trim().replace(/\.(groovy|tc)$/i, "").trim();
  if (tc && tc.length >= 2 && !/^generated$/i.test(tc)) {
    return tc;
  }

  for (const step of steps) {
    const urlHost = step.match(/https?:\/\/(?:www\.)?([a-z0-9-]+)/i);
    if (urlHost?.[1] && urlHost[1].length >= 2) {
      return capitalize(urlHost[1]);
    }
    const quoted = step.match(/['"]([^'"]+)['"]/);
    if (quoted?.[1] && /^https?:\/\//i.test(quoted[1])) {
      const m = quoted[1].match(/https?:\/\/(?:www\.)?([a-z0-9-]+)/i);
      if (m?.[1]) return capitalize(m[1]);
    }
  }

  const joined = steps.join(" ").toLowerCase();
  if (/\blogin\b/.test(joined)) return "Login";
  if (/\bsearch\b/.test(joined)) return "Search";
  if (/\blogout\b/.test(joined)) return "Logout";

  return "Custom";
}

export function inferKeywordMethodNameFromSteps(steps: string[], subject: string): string {
  const lower = steps.join(" ").toLowerCase();
  const sub = capitalize(subject.replace(/[^a-zA-Z0-9]/g, ""));
  if (/\b(visit|navigate|open)\b/.test(lower) && sub.length >= 2) {
    return `visit${sub}`;
  }
  return inferKeywordMethodName(subject);
}

/** Strip test-script header/imports; keep TestObjects + Actions for the keyword body. */
export function extractKeywordBodyLines(compiledScript: string): string[] {
  const lines = compiledScript.split(/\r?\n/);
  const body: string[] = [];
  let pastImports = false;

  for (const line of lines) {
    const t = line.trim();
    if (/^\/\/ Katalon Groovy/i.test(t) || /^\/\/ Test:/i.test(t)) continue;
    if (t.startsWith("import ")) {
      pastImports = true;
      continue;
    }
    if (!pastImports) continue;
    if (t === "" && body.length === 0) continue;
    body.push(line);
  }

  return body;
}

export function keywordImportsForBody(
  platform: KeywordTemplatePlatform,
  bodyLines: string[]
): string[] {
  const body = bodyLines.join("\n");
  const lines = [
    "import com.kms.katalon.core.annotation.Keyword",
    "import internal.GlobalVariable",
  ];

  if (platform === "mobile") {
    lines.splice(
      1,
      0,
      "import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile"
    );
  } else if (platform === "api") {
    lines.splice(
      1,
      0,
      "import com.kms.katalon.core.model.FailureHandling",
      "import com.kms.katalon.core.webservice.keyword.WSBuiltInKeywords as WS"
    );
  } else {
    lines.splice(
      1,
      0,
      "import com.kms.katalon.core.model.FailureHandling",
      "import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI"
    );
  }

  if (body.includes("findTestObject(")) {
    lines.splice(
      2,
      0,
      "import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject"
    );
  }
  if (/\bTestObject\b/.test(body) && /\baddProperty\b/.test(body)) {
    if (!lines.some((l) => l.includes("testobject.TestObject"))) {
      lines.splice(
        2,
        0,
        "import com.kms.katalon.core.testobject.TestObject",
        "import com.kms.katalon.core.testobject.ConditionType"
      );
    }
  }
  if (/\bKeys\./.test(body) && !lines.some((l) => l.includes("selenium.Keys"))) {
    lines.push("import org.openqa.selenium.Keys");
  }

  return lines;
}

export function wrapBodyAsKeywordClass(options: {
  subject: string;
  platform: KeywordTemplatePlatform;
  bodyLines: string[];
  methodName?: string;
}): string {
  const className = inferKeywordClassName(options.subject);
  const methodName =
    options.methodName ?? inferKeywordMethodName(options.subject);
  const imports = keywordImportsForBody(options.platform, options.bodyLines);

  const indented = options.bodyLines.map((line) => {
    const t = line.trim();
    if (!t) return "";
    return `        ${line.trimStart()}`;
  });

  const blocks = [
    "package common",
    "",
    ...imports,
    "",
    `class ${className} {`,
    "",
    "    @Keyword",
    `    def ${methodName}() {`,
    "",
    ...indented.filter((l, i, arr) => !(l === "" && i === arr.length - 1)),
    "    }",
    "}",
    "",
  ];

  return blocks.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export interface KeywordFromStepsResult {
  code: string;
  model: string;
  warnings: string[];
  validationErrors: string[];
  generationMode: "keyword_template";
  keywordTemplate: {
    className: string;
    methodName: string;
    platform: KeywordTemplatePlatform;
    confidence: number;
  };
}

/**
 * User chose "Custom keyword" — compile steps as test actions, wrap in @Keyword class.
 */
export function generateKeywordClassFromTestSteps(
  steps: string[],
  compileInput: CompileKatalonInput
): KeywordFromStepsResult | null {
  const trimmed = steps.map((s) => s.trim()).filter(Boolean);
  if (trimmed.length === 0) return null;

  const compiled = compileKatalonScript({ ...compileInput, steps: trimmed });
  if (compiled.validationErrors.length > 0 || !compiled.code.trim()) {
    return {
      code: "",
      model: KEYWORD_TEMPLATE_MODEL_ID,
      warnings: compiled.warnings,
      validationErrors: compiled.validationErrors,
      generationMode: "keyword_template",
      keywordTemplate: {
        className: "CustomKeywords",
        methodName: "execute",
        platform: compileInput.platform,
        confidence: 0,
      },
    };
  }

  const bodyLines = extractKeywordBodyLines(compiled.code);
  if (bodyLines.length === 0) {
    return {
      code: "",
      model: KEYWORD_TEMPLATE_MODEL_ID,
      warnings: ["No actions could be extracted from compiled steps."],
      validationErrors: ["Keyword body is empty after compiling steps."],
      generationMode: "keyword_template",
      keywordTemplate: {
        className: "CustomKeywords",
        methodName: "execute",
        platform: compileInput.platform,
        confidence: 0,
      },
    };
  }

  const subject = inferKeywordSubjectFromSteps(trimmed, compileInput.testCaseName);
  const platform =
    compileInput.platform === "mobile"
      ? "mobile"
      : detectKeywordTemplatePlatform(trimmed.join(" "));
  const methodName = inferKeywordMethodNameFromSteps(trimmed, subject);
  const code = wrapBodyAsKeywordClass({ subject, platform, bodyLines, methodName });

  const v = validateKeywordTemplateGroovy(code, { allowOpenBrowser: true });
  const className = inferKeywordClassName(subject);

  return {
    code: v.errors.length > 0 ? "" : code,
    model: KEYWORD_TEMPLATE_MODEL_ID,
    warnings: [
      ...compiled.warnings,
      ...v.warnings,
      "Wrapped compiled test steps inside a Custom Keyword class (@Keyword).",
    ],
    validationErrors: v.errors,
    generationMode: "keyword_template",
    keywordTemplate: {
      className,
      methodName,
      platform,
      confidence: 95,
    },
  };
}

export function buildSyntheticKeywordIntent(
  steps: string[],
  testCaseName?: string,
  platform: KeywordTemplatePlatform = "web"
): CreateKeywordIntent {
  const subject = inferKeywordSubjectFromSteps(steps, testCaseName);
  return {
    raw: steps.join("\n"),
    confidence: 95,
    subject,
    platform,
  };
}
