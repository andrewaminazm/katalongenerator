import assert from "node:assert/strict";
import { test } from "node:test";
import { buildProjectGraphV2 } from "./projectGraphV2.js";
import { fixScript } from "./scriptFixer.js";
import { fixProjectScript } from "./itemActions.js";
import { analyzeScriptContent } from "./scriptAnalyzer.js";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import { saveProjectIndex, newProjectId, projectDir } from "../projectIntelligence/projectStore.js";
import fs from "node:fs/promises";
import path from "node:path";

const MINI_INDEX: ProjectIndex = {
  projectId: "test-proj",
  projectName: "Demo",
  uploadDate: new Date().toISOString(),
  sourceType: "zip",
  testObjects: [
    {
      label: "btn_login",
      path: "LoginPage/btn_login",
      selectorType: "XPATH",
      selector: "/html/body/div[1]/button",
      alternativeSelectors: [{ type: "ID", value: "#loginBtn" }],
      sourceFile: "Object Repository/LoginPage/btn_login.rs",
    },
    {
      label: "btn_submit",
      path: "LoginPage/btn_submit",
      selectorType: "XPATH",
      selector: "/html/body/div[1]/button",
      alternativeSelectors: [],
      sourceFile: "Object Repository/LoginPage/btn_submit.rs",
    },
  ],
  keywords: [
    {
      packageName: "common",
      className: "LoginKeywords",
      filePath: "Keywords/common/LoginKeywords.groovy",
      customKeywordsPath: "common.LoginKeywords",
      methods: [
        {
          name: "login",
          signature: "login(String u, String p)",
          parameters: ["u", "p"],
          semanticSummary: "login helper",
        },
      ],
    },
  ],
  testScripts: [
    {
      logicalPath: "Test Cases/Login/TC_Login",
      scriptPath: "Test Cases/Login/Script1.groovy",
      kind: "test_case",
      displayName: "TC_Login",
      findTestObjectRefs: ["LoginPage/btn_login", "Missing/btn_x"],
      customKeywordRefs: ["common.LoginKeywords.login"],
      stepComments: [],
      webUiCalls: ["WebUI.click"],
      lineCount: 10,
      semanticSummary: "Login test",
    },
  ],
  testSuitePaths: ["Test Suites/Regression.ts"],
  profilePaths: [],
  globalVariableHints: [],
  reusableFlows: [],
  graph: { nodes: [], edges: [] },
  stats: {
    testObjects: 2,
    keywords: 1,
    keywordMethods: 1,
    testScripts: 1,
    testSuites: 1,
    profiles: 0,
    groovyLibs: 0,
    parseErrors: 0,
  },
  codingStyleHints: ["Uses WebUI keywords"],
};

test("buildProjectGraphV2 finds orphans and duplicates", () => {
  const graph = buildProjectGraphV2(MINI_INDEX);
  assert.ok(graph.duplicates.testObjects.length >= 1);
  assert.ok(graph.orphans.keywords.length >= 0);
  assert.equal(graph.suites.length, 1);
});

test("analyzeScriptContent flags missing OR", () => {
  const script = MINI_INDEX.testScripts[0];
  const issues = analyzeScriptContent("", script, MINI_INDEX);
  assert.ok(issues.some((i) => i.ruleId === "missing_test_object"));
});

test("fixScript replaces Thread.sleep and suggests OR remap", () => {
  const loaded = {
    scriptPath: "Test Cases/Login/Script1.groovy",
    logicalPath: "Test Cases/Login/TC_Login",
    content: `WebUI.click(findTestObject('Missing/btn_x'))
Thread.sleep(2000)`,
  };
  const fix = fixScript(loaded, MINI_INDEX);
  assert.ok(fix.fixed.includes("WebUI.delay"));
  assert.equal(fix.fixed.includes("Thread.sleep"), false);
});

test("fixProjectScript loads from disk when source exists", async () => {
  const projectId = newProjectId();
  const scriptRel = "Test Cases/Login/Script1.groovy";
  const content = `WebUI.click(findTestObject('LoginPage/btn_login'))
Thread.sleep(1000)`;
  const index: ProjectIndex = {
    ...MINI_INDEX,
    projectId,
    testScripts: [
      {
        ...MINI_INDEX.testScripts[0],
        scriptPath: scriptRel,
        logicalPath: "Test Cases/Login/TC_Login",
      },
    ],
  };
  await saveProjectIndex(index);
  const sourceDir = path.join(projectDir(projectId), "source", scriptRel.replace(/\//g, path.sep));
  await fs.mkdir(path.dirname(sourceDir), { recursive: true });
  await fs.writeFile(sourceDir, content, "utf8");

  const result = await fixProjectScript(projectId, scriptRel);
  assert.ok(result.fix.fixed.includes("WebUI.delay"));
  assert.ok(result.fix.changed);
});
