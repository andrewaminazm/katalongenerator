import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
    assert.equal(isConversationalFollowUp("yes please"), true);
    assert.equal(isConversationalFollowUp("what about negative cases?"), true);
    assert.equal(isConversationalFollowUp("same for mobile as we discussed"), true);
    assert.equal(isConversationalFollowUp("create test script for login with url and locators"), false);
  });

  it("formats prior messages for the prompt", () => {
    const text = formatConversationHistoryForPrompt([
      msg("user", "help me with login"),
      msg("assistant", "What platform?"),
    ]);
    assert.match(text, /User: help me with login/);
    assert.match(text, /Gosi Brain:/);
  });

  it("expands routing message for follow-ups", () => {
    const history = [
      msg("user", "I need a login test for our web app"),
      msg("assistant", "What is the login URL?"),
    ];
    const routed = buildRoutingMessage("yes it's https://app.example.com/login", history);
    assert.match(routed, /login test/);
    assert.match(routed, /https:\/\/app\.example\.com\/login/);
  });

  it("builds tiered history for long conversations", () => {
    const history = Array.from({ length: 40 }, (_, i) =>
      i % 2 === 0
        ? msg("user", `User message ${i} about login flow`)
        : msg("assistant", `Reply ${i} from Gosi Brain`)
    );
    const text = buildConversationHistoryForPrompt(history);
    assert.match(text, /Conversation memory/);
    assert.match(text, /Earlier conversation/);
    assert.match(text, /Recent conversation/);
    assert.match(text, /login/);
  });

  it("extracts and merges conversation facts", () => {
    const history = [
      msg("user", "We test login at https://app.example.com/login on web"),
      msg("assistant", "Noted"),
      msg("user", "yes use keywords"),
    ];
    const facts = extractConversationFacts(history);
    assert.match(facts.urls[0] ?? "", /https:\/\/app\.example\.com\/login/);
    assert.ok(facts.topics.includes("login"));
    assert.ok(facts.platforms.includes("web"));

    const merged = mergeConversationBrief(facts, [
      ...history,
      msg("user", "also checkout on https://shop.example.com"),
    ]);
    assert.ok(merged.topics.includes("checkout"));
  });
});
