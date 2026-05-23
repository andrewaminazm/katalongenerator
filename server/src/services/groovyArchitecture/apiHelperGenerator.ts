import { resolveUtilityImports } from "../groovyGenerator/groovyImportResolver.js";
import { wrapGroovyClass } from "./architectureTemplateEngine.js";
import { wrapTryCatch } from "./exceptionHandlingBuilder.js";
import { logInfo, loggingImports } from "./loggingPatternGenerator.js";
import { retryCallExpression } from "./retryEngineBuilder.js";
import type { ArchitecturePlan } from "./types.js";

export function buildApiHelper(plan: ArchitecturePlan): { code: string; buildersUsed: string[] } {
  const imports = [...resolveUtilityImports("api", { ws: true }), ...loggingImports()];
  const buildersUsed = ["apiHelperGenerator"];

  const inner = [
    ...(plan.intent.features.logging ? [logInfo("API: send request")] : []),
    "RequestObject request = findTestObject('Object Repository/API/Request_Main')",
    "def response = WS.sendRequest(request, FailureHandling.STOP_ON_FAILURE)",
    "assert response.getStatusCode() >= 200 && response.getStatusCode() < 300 : 'Unexpected status: ' + response.getStatusCode()",
    "return response",
  ];

  let body = plan.intent.features.exceptions
    ? wrapTryCatch(plan, inner)
    : inner.map((l) => `        ${l}`);

  if (plan.intent.features.retry) {
    body = retryCallExpression(plan, "        ", body.map((l) => l.trim()));
    buildersUsed.push("retryEngineBuilder");
  }

  const tokenMethod = /\btoken\b/i.test(plan.intent.raw)
    ? [
        "",
        "    static String generateToken(String username, String password) {",
        "        RequestObject auth = findTestObject('Object Repository/API/Request_Token')",
        "        def response = WS.sendRequest(auth, FailureHandling.STOP_ON_FAILURE)",
        "        return response.extractSOAPBodyAsContent()",
        "    }",
        "",
      ]
    : [];

  return {
    code: wrapGroovyClass({
      className: plan.className,
      imports,
      bodyLines: [
        `    static def ${plan.primaryMethod}() {`,
        ...body,
        "    }",
        ...tokenMethod,
      ],
    }),
    buildersUsed,
  };
}
