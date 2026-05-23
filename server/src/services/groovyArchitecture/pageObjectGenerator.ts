import { toPascalCase } from "../groovyGenerator/groovyBestPractices.js";
import { resolveUtilityImports } from "../groovyGenerator/groovyImportResolver.js";
import { wrapGroovyClass } from "./architectureTemplateEngine.js";
import type { ArchitecturePlan } from "./types.js";

export function buildPageObject(plan: ArchitecturePlan): { code: string; buildersUsed: string[] } {
  const page = plan.className.endsWith("Page") ? plan.className : `${plan.className}Page`;
  const imports = resolveUtilityImports("web", { webui: true, testObject: true });
  const segment = toPascalCase(plan.intent.subject.replace(/\bpage\b/gi, "").trim() || "App");

  const bodyLines = [
    `    // Locators — bind to Object Repository paths for ${segment}`,
    `    private static final String BTN_SUBMIT = 'Object Repository/${segment}/btn_Submit'`,
    `    private static final String TXT_FIELD = 'Object Repository/${segment}/txt_Field'`,
    "",
    "    static void open() {",
    "        WebUI.waitForPageLoad(30)",
    "    }",
    "",
    "    static void fillForm(String value) {",
    "        WebUI.waitForElementVisible(findTestObject(TXT_FIELD), 20)",
    "        WebUI.setText(findTestObject(TXT_FIELD), value ?: '')",
    "    }",
    "",
    "    static void submit() {",
    "        WebUI.waitForElementClickable(findTestObject(BTN_SUBMIT), 20)",
    "        WebUI.click(findTestObject(BTN_SUBMIT))",
    "        WebUI.waitForPageLoad(30)",
    "    }",
    "",
    "    static void verifyLoaded() {",
    "        WebUI.verifyElementPresent(findTestObject(BTN_SUBMIT), 15, FailureHandling.STOP_ON_FAILURE)",
    "    }",
  ];

  return {
    code: wrapGroovyClass({ className: page, imports, bodyLines }),
    buildersUsed: ["pageObjectGenerator"],
  };
}
