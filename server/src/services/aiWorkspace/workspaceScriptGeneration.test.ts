import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  inferCodeGenerationModeFromText,
  resolveCodeGenerationMode,
  wantsKatalonScriptGeneration,
} from "./workspaceScriptGeneration.js";
import type { WorkspaceMessage } from "./conversationHistory.js";
import type { RoutedIntent } from "./intentRouter.js";

describe("workspaceScriptGeneration", () => {
  it("infers page object from chat text", () => {
    assert.equal(
      inferCodeGenerationModeFromText("Create a page object for the login screen"),
      "page_object"
    );
  });

  it("infers custom keyword from chat text", () => {
    assert.equal(
      inferCodeGenerationModeFromText("Generate a custom keyword for checkout"),
      "custom_keyword"
    );
  });

  it("prefers latest message over history", () => {
    const history: WorkspaceMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Create a test script for login",
        timestamp: "2026-01-01T00:00:00Z",
      },
    ];
    assert.equal(
      resolveCodeGenerationMode("Now make it a page object instead", history),
      "page_object"
    );
  });

  it("allows architectural generation from a single chat line", () => {
    const route: RoutedIntent = {
      intent: "generate",
      agent: "qa_advisor",
      confidence: 0.9,
      orchestratorIntent: "testGeneration",
      secondaryIntents: [],
    };
    const msg = "Generate a framework helper class for retrying flaky clicks";
    assert.equal(wantsKatalonScriptGeneration(route, msg, [msg], {}, []), true);
  });
});
