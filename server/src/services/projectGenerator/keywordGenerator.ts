import type { ArchitecturePlan } from "./architectureEngine.js";
import type { GeneratedFile, GeneratedKeyword } from "./types.js";

function keywordClass(name: string, body: string): string {
  return `package customkeywords

import com.kms.katalon.core.annotation.Keyword
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile
import internal.GlobalVariable as GlobalVariable

/**
 * Enterprise keyword — generated scaffold. Extend with project-specific logic.
 */
class ${name} {

${body}
}
`;
}

export function generateKeywords(plan: ArchitecturePlan): {
  files: GeneratedFile[];
  keywords: GeneratedKeyword[];
} {
  const files: GeneratedFile[] = [];
  const keywords: GeneratedKeyword[] = [];
  const root = plan.projectName;

  const defs: { name: string; category: GeneratedKeyword["category"]; body: string }[] = [
    {
      name: "AuthenticationHelper",
      category: "auth",
      body: `    @Keyword
    static void loginWithCredentials(String username, String password) {
        WebUI.openBrowser('')
        WebUI.navigateToUrl(GlobalVariable.baseUrl)
        WebUI.setText(findTestObject('Object Repository/Auth/txt_username'), username)
        WebUI.setText(findTestObject('Object Repository/Auth/txt_password'), password, [('useClearText'): true])
        WebUI.click(findTestObject('Object Repository/Auth/btn_login'))
        WebUI.waitForPageLoad(30)
    }

    @Keyword
    static void logout() {
        WebUI.click(findTestObject('Object Repository/Auth/btn_logout'))
        WebUI.waitForPageLoad(15)
    }`,
    },
    {
      name: "RetryHelper",
      category: "wait",
      body: `    @Keyword
    static void retry(int maxAttempts, Closure action) {
        int attempt = 0
        Throwable lastError = null
        while (attempt < maxAttempts) {
            try {
                action.call()
                return
            } catch (Throwable t) {
                lastError = t
                attempt++
                WebUI.delay(1)
            }
        }
        if (lastError != null) {
            throw lastError
        }
    }`,
    },
    {
      name: "ScreenshotUtils",
      category: "util",
      body: `    @Keyword
    static void captureStep(String label) {
        String safe = label.replaceAll(/[^a-zA-Z0-9_-]/, '_')
        WebUI.takeScreenshot("Reports/screenshots/" + safe + "_" + System.currentTimeMillis())
    }`,
    },
    {
      name: "ApiClient",
      category: "api",
      body: `    @Keyword
    static def get(String path, Map headers = [:]) {
        def request = findTestObject('Object Repository/API/REST_Client')
        return WS.sendRequest(request)
    }`,
    },
    {
      name: "LoggingHelper",
      category: "util",
      body: `    @Keyword
    static void info(String message) {
        println("[INFO] " + message)
    }

    @Keyword
    static void error(String message) {
        println("[ERROR] " + message)
    }`,
    },
  ];

  if (plan.includeMobile) {
    defs.push({
      name: "MobileGestureHelper",
      category: "mobile",
      body: `    @Keyword
    static void tapByAccessibilityId(String id) {
        Mobile.tap(findTestObject('Object Repository/Mobile/elem_' + id), 10)
    }`,
    });
  }

  if (plan.includeReporting) {
    defs.push({
      name: "ExtentReportHelper",
      category: "reporting",
      body: `    @Keyword
    static void logPass(String step) {
        LoggingHelper.info("PASS: " + step)
    }

    @Keyword
    static void logFail(String step, String detail) {
        LoggingHelper.error("FAIL: " + step + " — " + detail)
        ScreenshotUtils.captureStep("fail_" + step)
    }`,
    });
  }

  for (const d of defs) {
    const rel = `Keywords/${d.name}.groovy`;
    files.push({
      path: `${root}/${rel}`,
      kind: "keyword",
      content: keywordClass(d.name, d.body),
      summary: `${d.category} keyword`,
    });
    keywords.push({ name: d.name, path: rel, category: d.category });
  }

  return { files, keywords };
}
