import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  generateKeywordClassFromTestSteps,
  inferKeywordSubjectFromSteps,
  wrapBodyAsKeywordClass,
} from "./keywordFromTestSteps.js";

describe("keywordFromTestSteps", () => {
  it("infers Google from visit google.com step", () => {
    assert.equal(
      inferKeywordSubjectFromSteps(['visit ("https://www.google.com/")']),
      "Google"
    );
  });

  it("wraps visit steps as Custom Keyword class", () => {
    const result = generateKeywordClassFromTestSteps(
      ['visit ("https://www.google.com/")'],
      { platform: "web", steps: [], locatorsText: "" }
    );
    assert.ok(result);
    assert.equal(result!.validationErrors.length, 0);
    assert.match(result!.code, /class GoogleKeywords/);
    assert.match(result!.code, /@Keyword/);
    assert.match(result!.code, /def visitGoogle\(\)/);
    assert.match(result!.code, /WebUI\.openBrowser\('https:\/\/www\.google\.com\/'/);
    assert.doesNotMatch(result!.code, /\/\/ Katalon Groovy — deterministic compiler/);
    assert.doesNotMatch(result!.code, /\/\/ Actions/);
  });

  it("includes FailureHandling import when body uses it", () => {
    const code = wrapBodyAsKeywordClass({
      subject: "Google",
      platform: "web",
      bodyLines: ["WebUI.openBrowser('https://www.google.com/', FailureHandling.STOP_ON_FAILURE)"],
      methodName: "visitGoogle",
    });
    assert.match(code, /FailureHandling/);
    assert.match(code, /package common/);
  });
});
