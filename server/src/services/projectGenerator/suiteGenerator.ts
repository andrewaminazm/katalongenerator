import type { ArchitecturePlan } from "./architectureEngine.js";
import type { GeneratedFile, GeneratedSuite } from "./types.js";

function suiteXml(name: string, testCases: string[]): string {
  const links = testCases
    .map(
      (tc) => `  <testCaseLink>
    <guid>${tc.replace(/[^a-zA-Z0-9]/g, "")}</guid>
    <testCaseId>${tc}</testCaseId>
  </testCaseLink>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<TestSuiteEntity>
  <description>${name} — generated suite</description>
  <name>${name}</name>
  <tag></tag>
  <testCaseLinks>
${links}
  </testCaseLinks>
</TestSuiteEntity>
`;
}

export function generateSuites(plan: ArchitecturePlan): {
  files: GeneratedFile[];
  suites: GeneratedSuite[];
} {
  const root = plan.projectName;
  const files: GeneratedFile[] = [];
  const suites: GeneratedSuite[] = [];

  const uiCases = plan.modules
    .filter((m) => !m.toLowerCase().includes("api"))
    .map((m) => `Test Cases/UI/TC_${m}_Smoke`);

  if (plan.includeUi && uiCases.length > 0) {
    for (const [name, type, cases] of [
      ["Smoke_Suite", "smoke" as const, uiCases.slice(0, 2)],
      ["Sanity_Suite", "sanity" as const, uiCases.slice(0, 4)],
      ["Regression_Suite", "regression" as const, uiCases],
      ["Critical_Path_Suite", "critical" as const, uiCases.slice(0, 1)],
    ] as const) {
      const path = `Test Suites/${name}.ts`;
      files.push({
        path: `${root}/${path}`,
        kind: "suite",
        content: suiteXml(name, cases),
        summary: `${type} suite`,
      });
      suites.push({ name, path, suiteType: type, testCasePaths: cases });
    }
  }

  if (plan.includeApi) {
    const apiCases = plan.modules.map((m) => `Test Cases/API/TC_${m}_Smoke`);
    const path = "Test Suites/API_Regression.ts";
    files.push({
      path: `${root}/${path}`,
      kind: "suite",
      content: suiteXml("API_Regression", apiCases.slice(0, 6)),
    });
    suites.push({
      name: "API_Regression",
      path,
      suiteType: "api",
      testCasePaths: apiCases.slice(0, 6),
    });
  }

  // Generate UI test case scripts
  if (plan.includeUi) {
    for (const mod of plan.modules.filter((m) => !m.toLowerCase().includes("api"))) {
      files.push({
        path: `${root}/Test Cases/UI/TC_${mod}_Smoke.groovy`,
        kind: "script",
        content: `import customkeywords.AuthenticationHelper
import customkeywords.ExtentReportHelper

AuthenticationHelper.loginWithCredentials('user@example.com', 'secret')
def page = new ${mod}Page()
page.open()
page.verifyLoaded()
ExtentReportHelper.logPass('${mod} smoke')
`,
        summary: `UI smoke test for ${mod}`,
      });
    }
  }

  // Flow services from business flows
  for (const flow of plan.flows.slice(0, 3)) {
    const safe = flow.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 40);
    files.push({
      path: `${root}/Keywords/FlowService_${safe}.groovy`,
      kind: "keyword",
      content: `import com.kms.katalon.core.annotation.Keyword

class FlowService_${safe} {
    @Keyword
    static void execute() {
        // Flow: ${flow}
        AuthenticationHelper.loginWithCredentials('user@example.com', 'secret')
    }
}
`,
      summary: `Reusable flow: ${flow}`,
    });
  }

  files.push({
    path: `${root}/Test Listeners/EnterpriseListener.groovy`,
    kind: "listener",
    content: `import com.kms.katalon.core.annotation.BeforeTestCase
import com.kms.katalon.core.annotation.AfterTestCase
import com.kms.katalon.core.model.TestCase

class EnterpriseListener {
    @BeforeTestCase
    def before(TestCase tc) {
        println('[LISTENER] Starting: ' + tc.getTestCaseId())
    }

    @AfterTestCase
    def after(TestCase tc) {
        println('[LISTENER] Finished: ' + tc.getTestCaseId())
    }
}
`,
  });

  return { files, suites };
}
