import type { ArchitecturePlan } from "./architectureEngine.js";
import type { GeneratedFile } from "./types.js";

export function generateMobileFramework(plan: ArchitecturePlan): GeneratedFile[] {
  if (!plan.includeMobile) return [];

  const root = plan.projectName;
  const files: GeneratedFile[] = [];

  files.push({
    path: `${root}/mobile/MobileBasePage.groovy`,
    kind: "mobile",
    content: `import com.kms.katalon.core.mobile.keyword.MobileBuiltInKeywords as Mobile
import static com.kms.katalon.core.testobject.ObjectRepository.findTestObject

class MobileBasePage {
    void waitForVisible(String orPath, int timeout = 15) {
        Mobile.waitForElementPresent(findTestObject(orPath), timeout)
    }

    void swipeUp() {
        Mobile.swipe(0, 800, 0, 200)
    }
}
`,
    summary: "Mobile base page with waits and gestures",
  });

  for (const mod of plan.modules.slice(0, 4)) {
    files.push({
      path: `${root}/mobile/${mod}MobilePage.groovy`,
      kind: "mobile",
      content: `class ${mod}MobilePage extends MobileBasePage {
    void openScreen() {
        waitForVisible('Object Repository/Mobile/${mod}/screen_root')
    }
}
`,
      summary: `Mobile page for ${mod}`,
    });

    files.push({
      path: `${root}/Object Repository/Mobile/${mod}/screen_root.rs`,
      kind: "or",
      content: `<?xml version="1.0" encoding="UTF-8"?>
<MobileElementEntity>
  <description>${mod} root screen</description>
  <name>screen_root</name>
  <locator>//*[@content-desc='${mod}']</locator>
  <locatorStrategy>XPATH</locatorStrategy>
</MobileElementEntity>
`,
    });
  }

  files.push({
    path: `${root}/Profiles/mobile-default.glbl`,
    kind: "profile",
    content: `<?xml version="1.0" encoding="UTF-8"?>
<GlobalVariableEntities>
  <name>mobile-default</name>
  <GlobalVariableEntity>
    <name>deviceName</name>
    <initValue>Pixel_6_API_33</initValue>
  </GlobalVariableEntity>
</GlobalVariableEntities>
`,
  });

  return files;
}
