import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import { scanProjectPatterns } from "./projectPatternScanner.js";
import {
  buildMemoryContextForGeneration,
  computeStyleMatchReport,
  resolveAiMemoryMode,
  shouldInjectMemory,
} from "./index.js";
import { buildPromptInjectionBlock } from "./generationContextBuilder.js";

const GROOVY_SOURCE = `
import com.kms.katalon.core.webui.keyword.WebUiBuiltInKeywords as WebUI
import com.kms.katalon.core.model.FailureHandling as FH
CustomKeywords.'framework.UiActions.safeClick'(findTestObject('Object Repository/btn_Login'))
WebUI.waitForElementVisible(findTestObject('Object Repository/txt_Username'), 30)
WebUI.verifyElementPresent(findTestObject('Object Repository/txt_Username'), 10, FH.STOP_ON_FAILURE)
`.trim();

function minimalIndex(overrides: Partial<ProjectIndex> = {}): ProjectIndex {
  return {
    projectId: "demo",
    projectName: "Demo",
    uploadDate: new Date().toISOString(),
    sourceType: "folder",
    testObjects: [
      {
        label: "btn_Login",
        path: "Object Repository/btn_Login.rs",
        selectorType: "XPATH",
        selector: "//button[@id='login']",
        alternativeSelectors: [],
        sourceFile: "Object Repository/btn_Login.rs",
      },
      {
        label: "txt_Username",
        path: "Object Repository/txt_Username.rs",
        selectorType: "XPATH",
        selector: "//input[@name='user']",
        alternativeSelectors: [],
        sourceFile: "Object Repository/txt_Username.rs",
      },
    ],
    keywords: [
      {
        packageName: "framework",
        className: "UiActions",
        filePath: "Keywords/framework/UiActions.groovy",
        customKeywordsPath: "framework.UiActions",
        methods: [
          {
            name: "safeClick",
            signature: "safeClick(TestObject to)",
            parameters: ["to"],
            semanticSummary: "safe click on element",
          },
        ],
      },
    ],
    testScripts: [
      {
        logicalPath: "Test Cases/Login/Script",
        scriptPath: "Test Cases/Login/Script.groovy",
        displayName: "Login",
        kind: "test_case",
        findTestObjectRefs: ["Object Repository/btn_Login", "Object Repository/txt_Username"],
        customKeywordRefs: ["framework.UiActions.safeClick"],
        stepComments: [],
        webUiCalls: ["waitForElementVisible", "verifyElementPresent"],
        lineCount: 10,
        semanticSummary: "login flow",
      },
    ],
    testSuites: [],
    profiles: [],
    groovyLibs: [],
    reusableFlows: [],
    codingStyleHints: [],
    parseErrors: [],
    stats: {
      testObjects: 2,
      keywords: 1,
      keywordMethods: 1,
      testScripts: 1,
      testSuites: 0,
      profiles: 0,
      groovyLibs: 0,
      parseErrors: 0,
    },
    ...overrides,
  };
}

describe("aiMemory", () => {
  it("resolveAiMemoryMode honors explicit values", () => {
    assert.equal(resolveAiMemoryMode("disabled"), "disabled");
    assert.equal(resolveAiMemoryMode("adaptive"), "adaptive");
    assert.equal(resolveAiMemoryMode("bogus"), "learn_suggest");
  });

  it("shouldInjectMemory only for suggest and adaptive", () => {
    assert.equal(shouldInjectMemory("learn_suggest"), true);
    assert.equal(shouldInjectMemory("adaptive"), true);
    assert.equal(shouldInjectMemory("learn_only"), false);
    assert.equal(shouldInjectMemory("disabled"), false);
  });

  it("scanProjectPatterns detects btn_ naming and keywords", () => {
    const profile = scanProjectPatterns(minimalIndex());
    assert.equal(profile.naming.testObjectPattern, "snake_prefix");
    assert.ok(profile.topKeywords.length > 0);
    assert.equal(profile.locators.dominantStrategy, "object_repository");
    assert.match(profile.promptInjectionBlock, /TEAM AI MEMORY/);
    assert.match(buildPromptInjectionBlock(profile), /btn_\*/);
  });

  it("buildMemoryContextForGeneration returns injection for learn_suggest", async () => {
    const ctx = await buildMemoryContextForGeneration(
      "demo",
      ["login as admin", "click login button"],
      minimalIndex(),
      "learn_suggest"
    );
    assert.ok(ctx);
    assert.ok(ctx!.injectionText.length > 50);
    assert.match(ctx!.injectionText, /TEAM AI MEMORY/);
  });

  it("computeStyleMatchReport scores keyword reuse", () => {
    const profile = scanProjectPatterns(minimalIndex());
    const code = `CustomKeywords.'framework.UiActions.safeClick'(findTestObject('Object Repository/btn_Login'))`;
    const report = computeStyleMatchReport(code, profile);
    assert.ok(report.styleMatchScore > 0);
    assert.ok(report.matchedPatterns.includes("object_repository"));
  });
});
