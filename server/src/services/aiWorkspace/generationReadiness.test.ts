import { describe, expect, it } from "vitest";
import {
  containsForbiddenPlaceholderCode,
  hasActionableGenerationInput,
  isVagueGenerationRequest,
  shouldAnalyzeBeforeGeneration,
} from "./generationReadiness.js";

describe("generationReadiness", () => {
  it("flags vague login script requests", () => {
    expect(isVagueGenerationRequest("create test script for login")).toBe(true);
    expect(
      shouldAnalyzeBeforeGeneration("create test script for login", ["create test script for login"], {})
    ).toBe(true);
  });

  it("allows actionable multiline steps", () => {
    const steps = [
      "Navigate to https://app.example.com/login",
      "Enter testuser in #username",
      "Click #loginBtn",
      "Verify dashboard is displayed",
    ];
    expect(hasActionableGenerationInput(steps.join("\n"), steps, {})).toBe(true);
    expect(shouldAnalyzeBeforeGeneration("Generate login test", steps, {})).toBe(false);
  });

  it("rejects forbidden placeholder code", () => {
    expect(containsForbiddenPlaceholderCode("// UNPARSED STEP — add locator")).toBe(true);
    expect(containsForbiddenPlaceholderCode("WebUI.click(findTestObject('Login/btn'))")).toBe(false);
  });
});
