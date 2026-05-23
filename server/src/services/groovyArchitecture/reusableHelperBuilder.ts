import { resolveUtilityImports } from "../groovyGenerator/groovyImportResolver.js";
import {
  matchDeterministicTemplate,
  renderTemplate,
} from "../groovyGenerator/groovyTemplateEngine.js";
import { defaultPackage } from "../groovyGenerator/groovyImportResolver.js";
import { wrapGroovyClass } from "./architectureTemplateEngine.js";
import { wrapTryCatch } from "./exceptionHandlingBuilder.js";
import { logInfo, loggingImports } from "./loggingPatternGenerator.js";
import { retryCallExpression, buildRetryHelperClass } from "./retryEngineBuilder.js";
import type { ArchitecturePlan } from "./types.js";

function isLoginHelper(plan: ArchitecturePlan): boolean {
  return /\blogin\b/i.test(plan.intent.subject) || /\blogin\b/i.test(plan.intent.raw);
}

export function buildReusableHelper(plan: ArchitecturePlan): { code: string; buildersUsed: string[] } {
  const buildersUsed = ["reusableHelperBuilder"];

  if (isLoginHelper(plan)) {
    return { code: buildLoginHelper(plan, buildersUsed), buildersUsed };
  }

  const simpleTemplate = matchDeterministicTemplate(plan.intent.utilityIntent);
  if (
    simpleTemplate?.matched &&
    !plan.intent.features.sessionValidation &&
    !plan.intent.features.screenshot
  ) {
    buildersUsed.push("groovyTemplateEngine");
    return { code: renderTemplate(simpleTemplate, plan.intent.utilityIntent), buildersUsed };
  }

  return { code: buildGenericHelper(plan, buildersUsed), buildersUsed };
}

function buildLoginHelper(plan: ArchitecturePlan, buildersUsed: string[]): string {
  buildersUsed.push("loginHelper");
  const loginMethod = "login";
  const imports = [
    ...resolveUtilityImports("web", { webui: true, testObject: true }),
    ...loggingImports(),
  ];
  const useEmbeddedRetry = plan.intent.features.retry && !plan.projectReuse.retryHelper;
  if (useEmbeddedRetry) {
    buildersUsed.push("retryEngineBuilder");
  }

  const inner: string[] = [];
  inner.push(logInfo("Login: start"));
  inner.push(
    "WebUI.waitForElementVisible(findTestObject('Object Repository/Login/btn_Login'), 30)",
    "WebUI.setText(findTestObject('Object Repository/Login/txt_Username'), username ?: '')",
    "WebUI.setEncryptedText(findTestObject('Object Repository/Login/txt_Password'), password ?: '')",
    "WebUI.click(findTestObject('Object Repository/Login/btn_Login'))",
    "WebUI.waitForPageLoad(30)"
  );
  if (plan.intent.features.sessionValidation) {
    inner.push("validateSession()");
    buildersUsed.push("sessionValidation");
  }
  inner.push(logInfo("Login: success"));

  let methodBody: string[];
  if (plan.intent.features.exceptions) {
    methodBody = wrapTryCatch(plan, inner);
  } else {
    methodBody = inner.map((l) => `        ${l}`);
  }

  if (plan.intent.features.retry) {
    methodBody = retryCallExpression(plan, "        ", methodBody.map((l) => l.trim()));
  }

  const validateMethod = plan.intent.features.sessionValidation
    ? [
        "",
        "    private static void validateSession() {",
        "        WebUI.verifyElementPresent(findTestObject('Object Repository/Common/loggedInIndicator'), 15, FailureHandling.STOP_ON_FAILURE)",
        "    }",
        "",
      ]
    : [""];

  const loginClass = wrapGroovyClass({
    className: plan.className,
    imports: [],
    bodyLines: [
      `    static void ${loginMethod}(String username, String password) {`,
      ...methodBody,
      "    }",
      ...validateMethod,
    ],
  });

  const pkg = defaultPackage();
  const header = [`package ${pkg}`, "", ...imports, ""].join("\n");
  if (useEmbeddedRetry) {
    return `${header}${buildRetryHelperClass().trimEnd()}\n\n${loginClass.trimEnd()}\n`;
  }
  return `${header}${loginClass.trimEnd()}\n`;
}

function buildGenericHelper(plan: ArchitecturePlan, buildersUsed: string[]): string {
  const imports = [
    ...resolveUtilityImports(plan.intent.platform, {
      webui: plan.intent.platform === "web",
      mobile: plan.intent.platform === "mobile",
      ws: plan.intent.platform === "api",
    }),
    ...(plan.intent.features.logging ? loggingImports() : []),
  ];

  const inner = [
    `// Implement ${plan.intent.subject}`,
    ...(plan.intent.features.logging ? [logInfo(`Execute: ${plan.intent.subject}`)] : []),
    "// Add WebUI / Mobile / WS calls for your application",
  ];

  let methodBody = plan.intent.features.exceptions
    ? wrapTryCatch(plan, inner)
    : inner.map((l) => `        ${l}`);

  if (plan.intent.features.retry) {
    methodBody = retryCallExpression(plan, "        ", methodBody.map((l) => l.trim()));
  }

  return wrapGroovyClass({
    className: plan.className,
    imports,
    bodyLines: [`    static void ${plan.primaryMethod}() {`, ...methodBody, "    }"],
  });
}
