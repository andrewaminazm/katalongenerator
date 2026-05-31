/** Bilingual (English + Arabic) plain-text helpers for Test Architect Chat. */

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

export function containsArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

export function containsEnglish(text: string): boolean {
  return /[a-zA-Z]/.test(text);
}

export type UserLanguageMode = "arabic" | "english" | "mixed";

/** Infer preferred reply language from recent user messages. */
export function detectUserLanguageMode(messages: string[]): UserLanguageMode {
  const recent = messages.filter(Boolean).slice(-3).join("\n");
  if (!recent.trim()) return "english";
  const hasAr = containsArabic(recent);
  const hasEn = containsEnglish(recent);
  if (hasAr && hasEn) return "mixed";
  if (hasAr) return "arabic";
  return "english";
}

export function replyLanguageInstruction(mode: UserLanguageMode): string {
  switch (mode) {
    case "arabic":
      return "The user writes in Arabic. Reply in clear Modern Standard Arabic (فصحى مبسطة). Keep Katalon, Groovy, Selenium, and API terms in English when standard. Section headers may be in Arabic.";
    case "mixed":
      return "The user mixes Arabic and English. Mirror their mix — Arabic prose with English for code, tool names, and Groovy.";
    default:
      return "The user writes in English. Reply in clear professional English.";
  }
}

export const BILINGUAL_FOLLOW_UP_RE =
  /^(yes|yeah|yep|yup|ok|okay|sure|please|go ahead|do it|continue|same|thanks|thank you|no|not that|instead|what about|how about|also|go on|next|and then|نعم|أيوه|ايوه|موافق|تمام|طيب|حسنا|حسناً|لا|مش|بل|بدلا|ماذا عن|شو عن|كمان|أيضاً|ايضا|كذلك|تابع|استمر|شكرا|شكراً)/i;

export const BILINGUAL_CONTEXT_REFERENCE_RE =
  /\b(it|that|this|those|same|above|previous|earlier|we discussed|you said|the login|the test|the script|the project)\b|(هذا|هذه|ذلك|تلك|نفس|سابق|السابق|قلت|ذكرت|ناقشنا|المشروع|الاختبار|تسجيل الدخول|الدخول)/i;

export const BILINGUAL_GENERATION_RE =
  /\b(create|generate|write|build|automate|script|keyword|test|review|analyze)\b|(أنشئ|انشئ|إنشاء|اعمل|اصنع|ولّد|ولد|اكتب|سكربت|سكريبت|اختبار|فحص|راجع|حلل|تحليل|مراجعة)/i;

export const BILINGUAL_TOPIC_PATTERNS: Array<[RegExp, string]> = [
  [/(login|تسجيل الدخول|تسجيل دخول|الدخول)/i, "login"],
  [/(checkout|شراء)/i, "checkout"],
  [/(registration|التسجيل|حساب جديد)/i, "registration"],
  [/(payment|الدفع|دفع)/i, "payment"],
  [/(keyword|كيورد|keywords|كلمة مفتاحية)/i, "custom keywords"],
  [/(page object|كائن صفحة)/i, "page objects"],
  [/(flaky|متقطع|غير مستقر)/i, "flaky tests"],
  [/(coverage|تغطية)/i, "coverage"],
  [/(performance|load test|k6|أداء|حمولة|حمل|اختبار حمل)/i, "performance testing"],
  [/(heal|locator|locators|محدد)/i, "locator healing"],
  [/(refactor|إعادة هيكلة)/i, "refactoring"],
  [/(project|المشروع|مشروع)/i, "project health"],
];

export const BILINGUAL_PLATFORM_PATTERNS: Array<[RegExp, string]> = [
  [/(web|browser|chrome|selenium|ويب|متصفح|موقع)/i, "web"],
  [/(mobile|appium|android|ios|موبايل|جوال|تطبيق)/i, "mobile"],
  [/(api|rest|postman|swagger|openapi|واجهة)/i, "api"],
];

export const BILINGUAL_YES_RE =
  /^(yes|yeah|yep|ok|okay|sure|correct|right|exactly|نعم|أيوه|ايوه|موافق|تمام|طيب|صح|صحيح)/i;

export const BILINGUAL_DECISION_RE =
  /(\b(use|prefer|let's go with|we use)\b.*\b(keyword|page object|web|mobile)\b)|(استخدم|نفضل|نستخدم|اعتماد).*(keyword|page object|web|mobile|كيورد|ويب|موبايل|جوال)/i;

export function isBilingualProjectReviewRequest(message: string): boolean {
  const t = message.trim();
  if (
    /^(check|review|analyze|inspect|audit|scan|look at)\s+(my\s+)?project\.?$/i.test(t) ||
    /^(راجع|افحص|حلل|تحقق من|فحص)\s+(مشروعي|المشروع|مشروع)/i.test(t)
  ) {
    return true;
  }
  return (
    /(check|review|inspect|audit|scan|analyze|look at|evaluate|assess|راجع|افحص|حلل|تحقق|فحص|مراجعة|تحليل)/i.test(t) &&
    /(my project|the project|this project|active project|project|مشروعي|المشروع|مشروع|مشروعنا)/i.test(t)
  );
}

export function matchBilingualIntentBoost(message: string): {
  intent: "analyze" | "explain" | "performance" | "convert";
  confidence: number;
} | null {
  if (isBilingualProjectReviewRequest(message)) {
    return { intent: "analyze", confidence: 0.92 };
  }
  if (
    /\b(help me|can you help|i need help|what should i test)\b/i.test(message) ||
    /(ساعدني|محتاج|أحتاج|احتاج|كيف أختبر|ماذا أختبر|شو أختبر)/i.test(message)
  ) {
    return { intent: "explain", confidence: 0.85 };
  }
  if (
    /\b(failing|failed|error|broken|flaky|not working)\b/i.test(message) ||
    /(فشل|فاشل|خطأ|لا يعمل|لا يشتغل|معطل|متقطع)/i.test(message)
  ) {
    return { intent: "explain", confidence: 0.87 };
  }
  if (
    /\b(jmeter|k6|load test|performance)\b/i.test(message) ||
    /(أداء|حمولة|اختبار حمل|اختبار الأداء)/i.test(message)
  ) {
    return { intent: "performance", confidence: 0.88 };
  }
  if (
    /\b(postman|swagger|openapi)\b/i.test(message) &&
    (/\b(convert|import|export)\b/i.test(message) || /(تحويل|استيراد)/i.test(message))
  ) {
    return { intent: "convert", confidence: 0.86 };
  }
  return null;
}
