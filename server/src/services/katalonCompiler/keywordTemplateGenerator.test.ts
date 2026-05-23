import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateKeywordClassTemplate,
  inferKeywordClassName,
  inferKeywordMethodName,
  compileKeywordTemplate,
} from "./keywordTemplateGenerator.js";
import { detectCreateKeywordIntent } from "../testDsl/keywordCreateIntent.js";
import { validateKeywordTemplateGroovy } from "./validationLayer.js";
import { generateKeywordTemplateFromSteps } from "./keywordGenerationRouter.js";

describe("keywordTemplateGenerator", () => {
  it("generates LoginKeywords with login method for login subject", () => {
    const intent = detectCreateKeywordIntent("create katalon keyword for login")!;
    const code = generateKeywordClassTemplate(intent);
    assert.match(code, /class LoginKeywords/);
    assert.match(code, /@Keyword/);
    assert.match(code, /def login\(String username, String password\)/);
    assert.match(code, /WebUI\.setText\(findTestObject\('Page_Login\/txt_Username'\)/);
    assert.match(code, /WebUI\.setEncryptedText\(findTestObject\('Page_Login\/txt_Password'\)/);
    assert.match(code, /WebUI\.click\(findTestObject\('Page_Login\/btn_Login'\)/);
    assert.doesNotMatch(code, /WebUI\.openBrowser/);
    assert.doesNotMatch(code, /verifyTextPresent/);
  });

  it("generates authenticate for authentication", () => {
    assert.equal(inferKeywordMethodName("authentication"), "authenticate");
    assert.equal(inferKeywordClassName("authentication"), "AuthenticationKeywords");
  });

  it("generates mobile keyword imports", () => {
    const intent = detectCreateKeywordIntent("create mobile keyword for login")!;
    const code = generateKeywordClassTemplate(intent);
    assert.match(code, /MobileBuiltInKeywords as Mobile/);
    assert.match(code, /Mobile\.tap\(/);
    assert.doesNotMatch(code, /WebUI\./);
  });

  it("generates api keyword with WS imports", () => {
    const intent = detectCreateKeywordIntent("create keyword class for api token generation")!;
    const code = generateKeywordClassTemplate(intent);
    assert.match(code, /WSBuiltInKeywords as WS/);
    assert.match(code, /def generateApiToken/);
    assert.match(code, /WS\.sendRequest/);
  });

  it("validates generated login template", () => {
    const result = generateKeywordTemplateFromSteps(["create katalon keyword for login"]);
    assert.ok(result);
    assert.equal(result!.generationMode, "keyword_template");
    const v = validateKeywordTemplateGroovy(result!.code);
    assert.deepEqual(v.errors, []);
    assert.match(result!.code, /package common/);
  });

  it("compileKeywordTemplate returns model id", () => {
    const intent = detectCreateKeywordIntent("generate keyword for logout")!;
    const out = compileKeywordTemplate(intent);
    assert.equal(out.methodName, "logout");
    assert.match(out.code, /btn_Logout/);
  });
});
