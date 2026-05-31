import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  containsForbiddenPlaceholderCode,
  hasActionableGenerationInput,
  isVagueGenerationRequest,
  shouldAnalyzeBeforeGeneration,
} from "./generationReadiness.js";

describe("generationReadiness", () => {
  it("flags vague login script requests", () => {
    assert.equal(isVagueGenerationRequest("create test script for login"), true);
    assert.equal(
      shouldAnalyzeBeforeGeneration("create test script for login", ["create test script for login"], {}),
      true
    );
  });

  it("allows actionable multiline steps", () => {
    const steps = [
      "Navigate to https://app.example.com/login",
      "Enter testuser in #username",
      "Click #loginBtn",
      "Verify dashboard is displayed",
    ];
    assert.equal(hasActionableGenerationInput(steps.join("\n"), steps, {}), true);
    assert.equal(shouldAnalyzeBeforeGeneration("Generate login test", steps, {}), false);
  });

  it("rejects forbidden placeholder code", () => {
    assert.equal(containsForbiddenPlaceholderCode("// UNPARSED STEP — add locator"), true);
    assert.equal(containsForbiddenPlaceholderCode("WebUI.click(findTestObject('Login/btn'))"), false);
  });
});
