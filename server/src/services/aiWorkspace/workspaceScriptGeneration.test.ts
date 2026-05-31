import { describe, expect, it } from "vitest";
import {
  inferCodeGenerationModeFromText,
  resolveCodeGenerationMode,
  wantsKatalonScriptGeneration,
} from "./workspaceScriptGeneration.js";
import type { WorkspaceMessage } from "./conversationHistory.js";

describe("workspaceScriptGeneration", () => {
  it("infers page object from chat text", () => {
    expect(inferCodeGenerationModeFromText("Create a page object for the login screen")).toBe(
      "page_object"
    );
  });

  it("infers custom keyword from chat text", () => {
    expect(inferCodeGenerationModeFromText("Generate a custom keyword for checkout")).toBe(
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
    expect(resolveCodeGenerationMode("Now make it a page object instead", history)).toBe(
      "page_object"
    );
  });

  it("allows architectural generation from a single chat line", () => {
    const route = { intent: "generate" as const, agent: "qa_advisor" as const, confidence: 0.9 };
    const msg = "Generate a framework helper class for retrying flaky clicks";
    expect(
      wantsKatalonScriptGeneration(route, msg, [msg], {}, [])
    ).toBe(true);
  });
});
