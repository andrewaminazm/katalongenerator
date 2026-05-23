import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectGroovyUtilityIntent } from "../testDsl/groovyUtilityIntent.js";
import { analyzeGenerationMode } from "./generationModeRouter.js";
import { compileGroovyUtility } from "./groovyFunctionGenerator.js";
import { validateGroovyUtilityAst } from "./groovyAstValidator.js";

describe("groovyUtilityIntent", () => {
  it("detects random email utility", () => {
    const i = detectGroovyUtilityIntent("create groovy function for random email generation");
    assert.ok(i);
    assert.match(i!.subject, /email/i);
    assert.equal(i!.platform, "utility");
  });

  it("detects retry helper", () => {
    const i = detectGroovyUtilityIntent("create retry mechanism utility");
    assert.ok(i);
    assert.match(i!.subject, /retry/i);
  });

  it("does not steal keyword-create lines", () => {
    assert.equal(detectGroovyUtilityIntent("create katalon keyword for login"), null);
  });
});

describe("generationModeRouter", () => {
  it("routes utility-only steps", () => {
    const a = analyzeGenerationMode(["create utility function for random email"]);
    assert.equal(a.mode, "groovy_utility");
  });

  it("hybrid when utility + test steps", () => {
    const a = analyzeGenerationMode([
      "create reusable login helper",
      "click btn_Login",
    ]);
    assert.equal(a.mode, "hybrid");
  });

  it("hybrid for utility + click step", () => {
    const a = analyzeGenerationMode([
      "create groovy function for screenshot",
      "click btn_Login",
    ]);
    assert.equal(a.mode, "hybrid");
  });
});

describe("groovyFunctionGenerator", () => {
  it("generates RandomDataUtils for email", async () => {
    const intent = detectGroovyUtilityIntent("create utility function for random email")!;
    const out = await compileGroovyUtility(intent, { forceDeterministic: true });
    assert.equal(out.validationErrors.length, 0);
    assert.match(out.code, /class RandomDataUtils/);
    assert.match(out.code, /generateRandomEmail/);
    assert.doesNotMatch(out.code, /WebUI\.openBrowser/);
    assert.doesNotMatch(out.code, /verifyTextPresent/);
  });

  it("generates RandomDataUtils for random name (no AI)", async () => {
    const intent = detectGroovyUtilityIntent(
      "create function for making generate random name"
    )!;
    assert.ok(intent);
    const out = await compileGroovyUtility(intent, { forceDeterministic: true });
    assert.equal(out.validationErrors.length, 0);
    assert.equal(out.groovyUtility.synthesizedBy, "template");
    assert.match(out.code, /class RandomDataUtils/);
    assert.match(out.code, /generateRandomName/);
    assert.match(out.code, /firstNames/);
    assert.doesNotMatch(out.code, /UnsupportedOperationException/);
  });

  it("generates RetryHelper template", async () => {
    const intent = detectGroovyUtilityIntent("create retry helper")!;
    const out = await compileGroovyUtility(intent, { forceDeterministic: true });
    assert.match(out.code, /class RetryHelper/);
    assert.match(out.code, /Closure action/);
  });

  it("rejects malicious patterns in validator", () => {
    const v = validateGroovyUtilityAst("class X { def run() { Runtime.getRuntime().exec('rm') } }");
    assert.ok(v.errors.length > 0);
  });
});
