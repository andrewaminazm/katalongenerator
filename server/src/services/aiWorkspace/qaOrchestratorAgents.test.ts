import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectQaAgentsForRequest } from "./qaOrchestratorAgents.js";
import type { RoutedIntent } from "./intentRouter.js";

const route = (intent: RoutedIntent["intent"], confidence = 0.9): RoutedIntent => ({
  intent,
  agent: "qa_advisor",
  confidence,
  orchestratorIntent: "conversationalAdvice",
  secondaryIntents: [],
});

describe("qaOrchestratorAgents", () => {
  it("selects failure stack for fix failing test", () => {
    const agents = selectQaAgentsForRequest(
      route("explain"),
      "Fix my failing login test — element not found on submit"
    );
    assert.ok(agents.includes("failure_analysis"));
    assert.ok(agents.includes("repair"));
    assert.ok(agents.includes("flaky"));
  });

  it("selects coverage stack for project analyze", () => {
    const agents = selectQaAgentsForRequest(route("analyze"), "Review my project for risks");
    assert.ok(agents.includes("coverage"));
    assert.ok(agents.includes("release_risk"));
  });

  it("selects generation stack for create tests", () => {
    const agents = selectQaAgentsForRequest(route("generate"), "Create login test script with steps");
    assert.ok(agents.includes("test_architect"));
    assert.ok(agents.includes("automation"));
  });
});
