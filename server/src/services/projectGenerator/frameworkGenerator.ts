import type { ArchitecturePlan } from "./architectureEngine.js";
import type { GeneratedFile } from "./types.js";

export function generateDataDrivenLayer(plan: ArchitecturePlan): GeneratedFile[] {
  if (plan.architecturePattern !== "data-driven" && plan.projectSize === "starter") {
    return [];
  }

  const root = plan.projectName;
  return [
    {
      path: `${root}/utils/DataReader.groovy`,
      kind: "keyword",
      content: `import com.kms.katalon.core.util.KeywordUtil

class DataReader {
    static List<Map> readCsv(String relativePath) {
        def rows = []
        new File(relativePath).eachLine { line, idx ->
            if (idx == 0) return
            def cols = line.split(',')
            rows << [username: cols[0], password: cols[1]]
        }
        return rows
    }
}
`,
    },
    {
      path: `${root}/Data Files/users.csv`,
      kind: "data",
      content: "username,password\nuser@example.com,secret\n",
    },
  ];
}

export function generateBddLayer(plan: ArchitecturePlan): GeneratedFile[] {
  if (!plan.includeBdd) return [];

  const root = plan.projectName;
  return [
    {
      path: `${root}/Include/features/smoke.feature`,
      kind: "script",
      content: `Feature: Smoke validation
  Scenario: User can login
    Given user opens login page
    When user logs in with valid credentials
    Then dashboard is displayed
`,
    },
    {
      path: `${root}/Keywords/StepDefinitions.groovy`,
      kind: "keyword",
      content: `import cucumber.api.java.en.Given
import cucumber.api.java.en.When
import cucumber.api.java.en.Then

class StepDefinitions {
    @Given("user opens login page")
    def openLogin() {
        AuthenticationHelper.loginWithCredentials('user@example.com', 'secret')
    }
}
`,
    },
  ];
}
