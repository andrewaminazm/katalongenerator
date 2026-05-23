import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractProjectDefaultUrl,
  stepRequestsProjectWebsite,
} from "./projectUrlResolver.js";

describe("projectUrlResolver", () => {
  it("detects project website phrases", () => {
    assert.equal(stepRequestsProjectWebsite("visit my website in my project"), true);
    assert.equal(stepRequestsProjectWebsite("open our site"), true);
    assert.equal(stepRequestsProjectWebsite("visit https://example.com"), false);
    assert.equal(stepRequestsProjectWebsite("click login"), false);
  });

  it("extracts dominant URL from indexed GOSI project", async () => {
    const url = await extractProjectDefaultUrl("cb06450a-5d6d-45d4-b58d-e14a106878fb");
    assert.ok(url);
    assert.match(url!, /^https:\/\//);
    assert.match(url!, /gosi/i);
  });

  it("compiles visit my website using project openToUrl keyword", async () => {
    const { compileKatalonScript } = await import("../katalonCompiler/index.js");
    const { loadProjectIndex } = await import("./index.js");
    const { buildGenerationPlan, bindingsByStepIndex } = await import("./generationPlanner.js");
    const { runUniversalTestStepIntelligence } = await import(
      "../testDsl/universalTestStepIntelligence.js"
    );
    const pid = "cb06450a-5d6d-45d4-b58d-e14a106878fb";
    const url = await extractProjectDefaultUrl(pid);
    assert.ok(url);
    const steps = runUniversalTestStepIntelligence({
      input: ["visit my website in my project"],
      platform: "web",
      projectDefaultUrl: url,
    }).canonicalSteps;
    assert.match(steps[0] ?? "", /navigate/i);
    const index = await loadProjectIndex(pid);
    assert.ok(index);
    const plan = buildGenerationPlan(steps, index!, "balanced", "web", {
      projectDefaultUrl: url,
      defaultUrl: url,
    });
    const bindings = bindingsByStepIndex(plan);
    const compiled = compileKatalonScript({
      platform: "web",
      steps,
      locatorsText: "",
      url,
      projectBindingsByStepIndex: bindings,
      projectKeywords: index!.keywords,
    });
    assert.doesNotMatch(compiled.code, /about:blank/);
    assert.doesNotMatch(compiled.code, /verifyTextPresent\s*\(\s*''/);
    assert.match(compiled.code, /gpt-qa\.gosi\.ins/);
    assert.ok(
      /CustomKeywords\.'common\.WebUiHelpers\.openToUrl'/.test(compiled.code) ||
        /WebUI\.openBrowser\s*\(\s*'https:\/\/gpt-qa\.gosi\.ins/.test(compiled.code)
    );
  });
});
