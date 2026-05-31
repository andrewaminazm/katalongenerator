import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectUserLanguageMode,
  isBilingualProjectReviewRequest,
  matchBilingualIntentBoost,
} from "./bilingualText.js";
import { isConversationalFollowUp } from "./conversationHistory.js";

describe("bilingualText", () => {
  it("detects Arabic user language", () => {
    assert.equal(detectUserLanguageMode(["ساعدني في اختبار تسجيل الدخول"]), "arabic");
    assert.equal(detectUserLanguageMode(["help me test login"]), "english");
    assert.equal(detectUserLanguageMode(["ساعدني with login test"]), "mixed");
  });

  it("recognizes Arabic project review", () => {
    assert.equal(isBilingualProjectReviewRequest("راجع مشروعي"), true);
  });

  it("boosts Arabic help and failure intents", () => {
    assert.equal(matchBilingualIntentBoost("ساعدني في الاختبار")?.intent, "explain");
    assert.equal(matchBilingualIntentBoost("الاختبار فاشل")?.intent, "explain");
  });

  it("recognizes Arabic follow-ups", () => {
    assert.equal(isConversationalFollowUp("نعم"), true);
    assert.equal(isConversationalFollowUp("ماذا عن الحالات السلبية؟"), true);
  });
});
