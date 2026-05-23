import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeGenerationMode } from "../groovyGenerator/generationModeRouter.js";
import { generateForcedOutputFromSteps } from "./forcedOutputFromSteps.js";

describe("forcedOutputFromSteps", () => {
  const steps = ['visit ("https://www.google.com/")'];
  const compileInput = { platform: "web" as const, steps: [], locatorsText: "" };

  it("analyzeGenerationMode forces wrap for page_object + test steps", () => {
    const a = analyzeGenerationMode(steps, "page_object");
    assert.equal(a.mode, "forced_wrap");
    assert.equal(a.forcedWrapMode, "page_object");
  });

  it("analyzeGenerationMode forces wrap for utility_class + test steps", () => {
    const a = analyzeGenerationMode(steps, "utility_class");
    assert.equal(a.mode, "forced_wrap");
    assert.equal(a.forcedWrapMode, "utility_class");
  });

  it("analyzeGenerationMode uses scaffold for utility_class create phrase", () => {
    const a = analyzeGenerationMode(["create utility class for retry"], "utility_class");
    assert.equal(a.mode, "groovy_utility");
    assert.ok(a.utilityIntents.length > 0);
  });

  it("generates page object class for visit step", async () => {
    const out = await generateForcedOutputFromSteps("page_object", steps, compileInput);
    assert.ok(out);
    assert.equal(out!.validationErrors.length, 0);
    assert.match(out!.code, /class GooglePage/);
    assert.match(out!.code, /static void visitGoogle/);
    assert.match(out!.code, /WebUI\.openBrowser/);
    assert.doesNotMatch(out!.code, /\/\/ Actions/);
  });

  it("generates utility class for visit step", async () => {
    const out = await generateForcedOutputFromSteps("utility_class", steps, compileInput);
    assert.ok(out);
    assert.match(out!.code, /class GoogleUtils/);
    assert.match(out!.code, /static void visitGoogle/);
  });

  it("generates custom keyword for visit step", async () => {
    const out = await generateForcedOutputFromSteps("custom_keyword", steps, compileInput);
    assert.ok(out);
    assert.match(out!.code, /@Keyword/);
    assert.match(out!.code, /class GoogleKeywords/);
  });
});
