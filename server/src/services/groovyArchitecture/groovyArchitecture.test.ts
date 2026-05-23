import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeArchitecturePrompt } from "./architectureIntentAnalyzer.js";
import { compileArchitectureGroovy } from "./groovyFunctionGenerator.js";

describe("groovyArchitecture", () => {
  it("detects login helper with retry and session features", () => {
    const intent = analyzeArchitecturePrompt(
      "create reusable login helper with retry and session validation"
    );
    assert.ok(intent);
    assert.equal(intent!.kind, "reusable_helper");
    assert.equal(intent!.features.retry, true);
    assert.equal(intent!.features.sessionValidation, true);
  });

  it("generates enterprise LoginHelper without AI", async () => {
    const out = await compileArchitectureGroovy(
      "create reusable login helper with retry and session validation",
      { forceDeterministic: true }
    );
    assert.ok(out);
    assert.equal(out!.validationErrors.length, 0);
    assert.match(out!.code, /class LoginHelper/);
    assert.match(out!.code, /static void login/);
    assert.match(out!.code, /RetryHelper\.retry/);
    assert.match(out!.code, /validateSession/);
    assert.match(out!.code, /KeywordUtil/);
    assert.match(out!.code, /WebUI\.waitForElementVisible/);
    assert.doesNotMatch(out!.code, /UnsupportedOperationException/);
    assert.equal(out!.synthesizedBy, "architecture");
  });

  it("generates page object scaffold", async () => {
    const out = await compileArchitectureGroovy("create Checkout page object", {
      forceDeterministic: true,
    });
    assert.ok(out);
    assert.match(out!.code, /Page/);
    assert.match(out!.code, /verifyLoaded/);
  });
});
