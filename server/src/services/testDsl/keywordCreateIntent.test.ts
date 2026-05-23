import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  detectCreateKeywordIntent,
  extractKeywordCreateSubject,
} from "./keywordCreateIntent.js";
import { analyzeKeywordGenerationRequest } from "../katalonCompiler/keywordGenerationRouter.js";

describe("keywordCreateIntent", () => {
  it("detects login keyword creation phrase", () => {
    const intent = detectCreateKeywordIntent("create katalon keyword for login");
    assert.ok(intent);
    assert.equal(intent!.subject, "login");
    assert.equal(intent!.platform, "web");
    assert.ok(intent!.confidence >= 70);
  });

  it("detects authentication and search phrases", () => {
    const auth = detectCreateKeywordIntent("create custom keyword for authentication");
    assert.equal(auth?.subject, "authentication");

    const search = detectCreateKeywordIntent("generate keyword for search");
    assert.equal(search?.subject, "search");
  });

  it("detects mobile platform", () => {
    const m = detectCreateKeywordIntent("create mobile keyword for login");
    assert.equal(m?.platform, "mobile");
  });

  it("detects api platform", () => {
    const a = detectCreateKeywordIntent("create keyword class for api token generation");
    assert.equal(a?.platform, "api");
    assert.match(a?.subject ?? "", /token/i);
  });

  it("returns null for malformed low-confidence phrase", () => {
    assert.equal(detectCreateKeywordIntent("click login button"), null);
    assert.equal(detectCreateKeywordIntent("create something"), null);
  });

  it("extractKeywordCreateSubject parses upload file", () => {
    assert.equal(
      extractKeywordCreateSubject("make katalon custom keyword for upload file"),
      "upload file"
    );
  });
});

describe("keywordGenerationRouter analyze", () => {
  it("routes single keyword-create step to keyword_template", () => {
    const a = analyzeKeywordGenerationRequest(["create katalon keyword for login"]);
    assert.equal(a.mode, "keyword_template");
    assert.ok(a.intent);
  });

  it("falls back when mixed with test steps", () => {
    const a = analyzeKeywordGenerationRequest(["create keyword for login", "click btn_Login"]);
    assert.equal(a.mode, "mixed_fallback");
  });

  it("falls back for normal test flow", () => {
    const a = analyzeKeywordGenerationRequest(["visit https://example.com", "click Login"]);
    assert.equal(a.mode, "test_case");
  });
});
