import { describe, expect, it } from "vitest";
import {
  detectUserLanguageMode,
  isBilingualProjectReviewRequest,
  matchBilingualIntentBoost,
} from "./bilingualText.js";
import { isConversationalFollowUp } from "./conversationHistory.js";

describe("bilingualText", () => {
  it("detects Arabic user language", () => {
    expect(detectUserLanguageMode(["ساعدني في اختبار تسجيل الدخول"])).toBe("arabic");
    expect(detectUserLanguageMode(["help me test login"])).toBe("english");
    expect(detectUserLanguageMode(["ساعدني with login test"])).toBe("mixed");
  });

  it("recognizes Arabic project review", () => {
    expect(isBilingualProjectReviewRequest("راجع مشروعي")).toBe(true);
  });

  it("boosts Arabic help and failure intents", () => {
    expect(matchBilingualIntentBoost("ساعدني في الاختبار")?.intent).toBe("explain");
    expect(matchBilingualIntentBoost("الاختبار فاشل")?.intent).toBe("explain");
  });

  it("recognizes Arabic follow-ups", () => {
    expect(isConversationalFollowUp("نعم")).toBe(true);
    expect(isConversationalFollowUp("ماذا عن الحالات السلبية؟")).toBe(true);
  });
});
