import type { CreateKeywordIntent, KeywordTemplatePlatform } from "../testDsl/keywordCreateIntent.js";

export const KEYWORD_TEMPLATE_MODEL_ID = "katalon-keyword-template-v1";

const METHOD_ALIASES: Record<string, string> = {
  login: "login",
  authentication: "authenticate",
  auth: "authenticate",
  logout: "logout",
  search: "search",
  "upload file": "uploadFile",
  upload: "uploadFile",
  "api token": "generateApiToken",
  "api token generation": "generateApiToken",
  "token generation": "generateApiToken",
};

function capitalize(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function inferKeywordClassName(subject: string): string {
  const words = subject
    .trim()
    .split(/[\s_-]+/)
    .filter((w) => w.length > 0)
    .map((w) => capitalize(w.replace(/[^a-zA-Z0-9]/g, "")))
    .filter(Boolean);
  const base = words.join("") || "Custom";
  return `${base}Keywords`;
}

export function inferKeywordMethodName(subject: string): string {
  const key = subject.trim().toLowerCase();
  if (METHOD_ALIASES[key]) return METHOD_ALIASES[key];
  const words = subject.trim().split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return "execute";
  if (words.length === 1) {
    const w = words[0].toLowerCase();
    return w.replace(/[^a-zA-Z0-9]/g, "") || "execute";
  }
  const [first, ...rest] = words;
  return (
    first.toLowerCase().replace(/[^a-zA-Z0-9]/g, "") +
    rest.map((w) => capitalize(w.replace(/[^a-zA-Z0-9]/g, ""))).join("")
  );
}

export function inferPageRepositoryPrefix(subject: string): string {
  const words = subject
    .trim()
    .split(/[\s_-]+/)
    .filter((w) => w.length > 0)
    .map((w) => capitalize(w.replace(/[^a-zA-Z0-9]/g, "")))
    .filter(Boolean);
  const base = words.join("") || "Custom";
  return `Page_${base}`;
}

export interface MethodSignature {
  params: string;
  bodyLines: string[];
}

function webMethodBody(subject: string, page: string, methodName: string): MethodSignature {
  const lower = subject.toLowerCase();

  if (lower.includes("login") || lower.includes("auth")) {
    return {
      params: "String username, String password",
      bodyLines: [
        `WebUI.setText(findTestObject('${page}/txt_Username'), username)`,
        "",
        `WebUI.setEncryptedText(findTestObject('${page}/txt_Password'), password)`,
        "",
        `WebUI.click(findTestObject('${page}/btn_Login'))`,
      ],
    };
  }
  if (lower.includes("logout")) {
    return {
      params: "",
      bodyLines: [`WebUI.click(findTestObject('${page}/btn_Logout'))`],
    };
  }
  if (lower.includes("search")) {
    return {
      params: "String query",
      bodyLines: [
        `WebUI.setText(findTestObject('${page}/txt_Search'), query)`,
        `WebUI.click(findTestObject('${page}/btn_Search'))`,
      ],
    };
  }
  if (lower.includes("upload")) {
    return {
      params: "String filePath",
      bodyLines: [`WebUI.uploadFile(findTestObject('${page}/inp_File'), filePath)`],
    };
  }

  return {
    params: "",
    bodyLines: [`WebUI.comment('TODO: implement ${methodName}')`],
  };
}

function mobileMethodBody(subject: string, page: string, methodName: string): MethodSignature {
  const lower = subject.toLowerCase();
  if (lower.includes("login") || lower.includes("auth")) {
    return {
      params: "String username, String password",
      bodyLines: [
        `Mobile.setText(findTestObject('${page}/txt_Username'), username)`,
        `Mobile.setEncryptedText(findTestObject('${page}/txt_Password'), password)`,
        `Mobile.tap(findTestObject('${page}/btn_Login'))`,
      ],
    };
  }
  if (lower.includes("search")) {
    return {
      params: "String query",
      bodyLines: [
        `Mobile.setText(findTestObject('${page}/txt_Search'), query)`,
        `Mobile.tap(findTestObject('${page}/btn_Search'))`,
      ],
    };
  }
  return {
    params: "",
    bodyLines: [`Mobile.comment('TODO: implement ${methodName}')`],
  };
}

function apiMethodBody(subject: string, methodName: string): MethodSignature {
  const lower = subject.toLowerCase();
  if (lower.includes("token")) {
    return {
      params: "String baseUrl, String clientId, String clientSecret",
      bodyLines: [
        "def response = WS.sendRequest(",
        "    findTestObject('API_Auth/Request_Token'),",
        "    FailureHandling.STOP_ON_FAILURE",
        ")",
        "return response",
      ],
    };
  }
  return {
    params: "String endpointUrl",
    bodyLines: [
      "def response = WS.sendRequest(",
      "    findTestObject('API_Common/Request_Default'),",
      "    FailureHandling.STOP_ON_FAILURE",
      ")",
      "return response",
    ],
  };
}

function platformImports(platform: KeywordTemplatePlatform): string[] {
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
      "import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI"
    );
  }
  return lines;
}

export function generateKeywordClassTemplate(intent: CreateKeywordIntent): string {
  const className = inferKeywordClassName(intent.subject);
  const methodName = inferKeywordMethodName(intent.subject);
  const page = inferPageRepositoryPrefix(intent.subject);

  const sig =
    intent.platform === "mobile"
      ? mobileMethodBody(intent.subject, page, methodName)
      : intent.platform === "api"
        ? apiMethodBody(intent.subject, methodName)
        : webMethodBody(intent.subject, page, methodName);

  const paramList = sig.params.trim();
  const paramDecl = paramList ? `(${paramList})` : "()";

  const lines: string[] = [
    "package common",
    "",
    ...platformImports(intent.platform),
    "",
    `class ${className} {`,
    "",
    "    @Keyword",
    `    def ${methodName}${paramDecl} {`,
    "",
  ];

  for (const bodyLine of sig.bodyLines) {
    lines.push(bodyLine ? `        ${bodyLine}` : "");
  }

  lines.push("    }", "}", "");

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

export interface KeywordTemplateCompileResult {
  code: string;
  model: string;
  warnings: string[];
  validationErrors: string[];
  className: string;
  methodName: string;
  platform: KeywordTemplatePlatform;
}

export function compileKeywordTemplate(intent: CreateKeywordIntent): KeywordTemplateCompileResult {
  const code = generateKeywordClassTemplate(intent);
  const warnings: string[] = [];
  if (intent.subject === "Custom") {
    warnings.push(
      "Keyword topic was unclear — using generic class/method names. Prefer: create keyword for login"
    );
  }
  return {
    code,
    model: KEYWORD_TEMPLATE_MODEL_ID,
    warnings,
    validationErrors: [],
    className: inferKeywordClassName(intent.subject),
    methodName: inferKeywordMethodName(intent.subject),
    platform: intent.platform,
  };
}
