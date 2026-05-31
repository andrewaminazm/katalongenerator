import { describe, expect, it } from "vitest";
import {
  buildConversationHistoryForPrompt,
  buildRoutingMessage,
  extractConversationFacts,
  formatConversationHistoryForPrompt,
  isConversationalFollowUp,
  mergeConversationBrief,
} from "./conversationHistory.js";

const msg = (
  role: "user" | "assistant",
  content: string,
  id = String(Math.random())
) => ({
  id,
  role,
  content,
  timestamp: new Date().toISOString(),
});

describe("conversationHistory", () => {
  it("detects short follow-ups and context references", () => {
    expect(isConversationalFollowUp("yes please")).toBe(true);
    expect(isConversationalFollowUp("what about negative cases?")).toBe(true);
    expect(isConversationalFollowUp("same for mobile as we discussed")).toBe(true);
    expect(isConversationalFollowUp("create test script for login with url and locators")).toBe(false);
  });

  it("formats prior messages for the prompt", () => {
    const text = formatConversationHistoryForPrompt([
      msg("user", "help me with login"),
      msg("assistant", "What platform?"),
    ]);
    expect(text).toContain("User: help me with login");
    expect(text).toContain("Gosi Brain:");
  });

  it("expands routing message for follow-ups", () => {
    const history = [
      msg("user", "I need a login test for our web app"),
      msg("assistant", "What is the login URL?"),
    ];
    const routed = buildRoutingMessage("yes it's https://app.example.com/login", history);
    expect(routed).toContain("login test");
    expect(routed).toContain("https://app.example.com/login");
  });

  it("builds tiered history for long conversations", () => {
    const history = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0
        ? msg("user", `User message ${i} about login flow`)
        : msg("assistant", `Reply ${i} from Gosi Brain`)
    );
    const text = buildConversationHistoryForPrompt(history);
    expect(text).toContain("Conversation memory");
    expect(text).toContain("Earlier conversation");
    expect(text).toContain("Recent conversation");
    expect(text).toContain("login");
  });

  it("extracts and merges conversation facts", () => {
    const history = [
      msg("user", "We test login at https://app.example.com/login on web"),
      msg("assistant", "Noted"),
      msg("user", "yes use keywords"),
    ];
    const facts = extractConversationFacts(history);
    expect(facts.urls[0]).toContain("https://app.example.com/login");
    expect(facts.topics).toContain("login");
    expect(facts.platforms).toContain("web");

    const merged = mergeConversationBrief(facts, [
      ...history,
      msg("user", "also checkout on https://shop.example.com"),
    ]);
    expect(merged.topics).toContain("checkout");
  });
});
