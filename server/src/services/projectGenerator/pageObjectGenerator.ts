import type { ArchitecturePlan } from "./architectureEngine.js";
import type { GeneratedFile, GeneratedPageObject } from "./types.js";

function pageClass(moduleName: string, actions: string[], validations: string[]): string {
  const cls = `${moduleName}Page`;
  const actionMethods = actions
    .map(
      (a) => `    void ${a}() {
        WebUI.waitForPageLoad(20)
        // TODO: implement ${a} using Object Repository locators
    }`
    )
    .join("\n\n");

  const validationMethods = validations
    .map(
      (v) => `    void ${v}() {
        WebUI.verifyElementPresent(findTestObject('Object Repository/${moduleName}/lbl_status'), 10)
    }`
    )
    .join("\n\n");

  return `import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject
import customkeywords.RetryHelper
import customkeywords.ScreenshotUtils

/**
 * Page Object — ${moduleName}
 * Pattern: enterprise POM with reusable actions and validations.
 */
class ${cls} {

${actionMethods}

${validationMethods}

    void captureState(String step) {
        ScreenshotUtils.captureStep('${moduleName}_' + step)
    }
}
`;
}

function orXml(moduleName: string, elements: { id: string; selector: string; tag: string }[]): string {
  const entities = elements
    .map(
      (e) => `  <WebElementEntity>
    <description>${e.tag}</description>
    <name>${e.id}</name>
    <tag></tag>
    <locator>${e.selector}</locator>
    <locatorStrategy>XPATH</locatorStrategy>
    <properties>
      <healingMeta>
        <fallbacks>${e.selector.replace(/"/g, "&quot;")}</fallbacks>
        <score>0.85</score>
      </healingMeta>
    </properties>
  </WebElementEntity>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<WebElementEntity>
  <description>Object Repository — ${moduleName}</description>
  <name>${moduleName}</name>
  <tag></tag>
  <elementGuidId>${moduleName.toLowerCase()}-or-root</elementGuidId>
  <selectorCollection>
${entities}
  </selectorCollection>
</WebElementEntity>
`;
}

export function generatePageObjects(plan: ArchitecturePlan): {
  files: GeneratedFile[];
  pages: GeneratedPageObject[];
} {
  if (!plan.includeUi) return { files: [], pages: [] };

  const files: GeneratedFile[] = [];
  const pages: GeneratedPageObject[] = [];
  const root = plan.projectName;

  for (const mod of plan.modules.filter((m) => !m.toLowerCase().includes("api"))) {
    const actions = ["open", "performPrimaryAction", "submit"];
    const validations = ["verifyLoaded", "verifySuccessMessage"];
    const cls = `${mod}Page`;

    files.push({
      path: `${root}/pages/${cls}.groovy`,
      kind: "page",
      content: pageClass(mod, actions, validations),
      summary: `Page object for ${mod}`,
    });

    const orElements = [
      { id: "btn_primary", selector: `//button[contains(@data-module,'${mod}')]`, tag: "Primary action" },
      { id: "lbl_status", selector: `//*[contains(@class,'status') and contains(@data-module,'${mod}')]`, tag: "Status label" },
      { id: "inp_search", selector: `//input[contains(@placeholder,'Search')]`, tag: "Search input" },
    ];

    files.push({
      path: `${root}/Object Repository/${mod}/PageElements.rs`,
      kind: "or",
      content: orXml(mod, orElements),
      summary: `Semantic OR for ${mod}`,
    });

    pages.push({
      name: cls,
      path: `pages/${cls}.groovy`,
      actions,
      validations,
    });
  }

  // Auth OR always for UI/hybrid
  files.push({
    path: `${root}/Object Repository/Auth/LoginElements.rs`,
    kind: "or",
    content: orXml("Auth", [
      { id: "txt_username", selector: "//input[@id='username' or @name='username']", tag: "Username" },
      { id: "txt_password", selector: "//input[@type='password']", tag: "Password" },
      { id: "btn_login", selector: "//button[@type='submit' or contains(.,'Login')]", tag: "Login button" },
      { id: "btn_logout", selector: "//a[contains(.,'Logout') or contains(.,'Sign out')]", tag: "Logout" },
    ]),
    summary: "Shared authentication OR",
  });

  return { files, pages };
}
