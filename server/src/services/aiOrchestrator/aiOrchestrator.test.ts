import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeIntent } from "./intentEngine.js";
import { planTasks, orderTasks } from "./taskPlanner.js";
import { routeCapabilities } from "./capabilityRouter.js";
import { runOrchestration } from "./orchestrator.js";
import { validateArtifact } from "./validationOrchestrator.js";

describe("AI Automation Orchestrator", () => {
  it("classifies login test generation", () => {
    const intent = analyzeIntent("create login test");
    assert.equal(intent.primary, "testGeneration");
    assert.ok(intent.confidence > 0.5);
  });

  it("classifies utility generation", () => {
    const intent = analyzeIntent("create reusable retry helper");
    assert.equal(intent.primary, "utilityGeneration");
  });

  it("classifies flaky test analysis", () => {
    const intent = analyzeIntent("fix flaky login tests");
    assert.equal(intent.primary, "flakyTestAnalysis");
  });

  it("plans mixed helper + test request", () => {
    const intent = analyzeIntent("create login helper and login test");
    const plan = orderTasks(planTasks(intent, [], "advanced"));
    assert.ok(plan.tasks.length >= 1);
    const routed = routeCapabilities(intent, [], "advanced");
    assert.ok(routed.generators.length >= 1);
  });

  it("runs end-to-end login test orchestration", async () => {
    const result = await runOrchestration({
      platform: "web",
      prompt: "create login test",
      steps: ["visit login page", "enter username admin", "enter password secret", "click login"],
      orchestrationMode: "basic",
      deterministicCompiler: true,
    });
    assert.ok(result.code.length > 20);
    assert.equal(result.intent.primary, "testGeneration");
    assert.ok(result.confidence.overall > 0.3);
  });

  it("generates reusable login helper via architecture path", async () => {
    const result = await runOrchestration({
      platform: "web",
      prompt: "create reusable login helper with retry and session validation",
      orchestrationMode: "advanced",
      deterministicCompiler: true,
    });
    assert.match(result.code, /LoginHelper|login/i);
    assert.ok(result.artifacts.length >= 1);
  });

  it("rejects dangerous code in validation", () => {
    const v = validateArtifact({
      taskId: "x",
      generator: "utilityGenerator",
      agent: "security",
      code: 'class X { void m() { Runtime.getRuntime().exec("rm -rf /") } }',
      model: "test",
      warnings: [],
      validationErrors: [],
    });
    assert.equal(v.ok, false);
    assert.ok(v.errors.some((e) => e.includes("Security")));
  });
});
