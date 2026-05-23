export type KeywordTemplatePlatform = "web" | "mobile" | "api";

export interface CreateKeywordIntent {
  raw: string;
  /** 0–100; use >= 70 to route to keyword template generator */
  confidence: number;
  /** Human topic, e.g. login, upload file */
  subject: string;
  platform: KeywordTemplatePlatform;
}

const CREATE_KEYWORD_PHRASE =
  /\b(?:(?:create|generate|make)\s+(?:a\s+)?(?:(?:katalon|custom|reusable|mobile|api)\s+)*(?:keyword\s+class|keywords?|custom\s+keywords?)|(?:create|generate)\s+katalon\s+keyword|(?:custom|reusable)\s+keyword)\b/i;

const CONFIDENCE_THRESHOLD = 70;

function cleanSubject(fragment: string): string {
  return fragment
    .replace(/\b(with|using|that|on|in|the|a|an|mobile|api|katalon|custom|reusable|web|webui)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractKeywordCreateSubject(raw: string): string | undefined {
  const s = raw.trim();
  const patterns = [
    /\bkeyword\s+class\s+for\s+(.+)$/i,
    /\b(?:custom|reusable|katalon|mobile|api)\s+keywords?\s+for\s+(.+)$/i,
    /\b(?:create|generate|make)\s+(?:[\w]+\s+){0,8}keywords?\s+for\s+(.+)$/i,
    /\b(?:create|generate|make)\s+(?:[\w]+\s+){0,8}keyword\s+for\s+(.+)$/i,
    /\bfor\s+(.+)$/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m?.[1]) {
      const sub = cleanSubject(m[1]);
      if (sub.length >= 2) return sub;
    }
  }
  return undefined;
}

export function detectKeywordTemplatePlatform(raw: string): KeywordTemplatePlatform {
  const lower = raw.toLowerCase();
  if (/\b(mobile|appium|android|ios)\b/.test(lower)) return "mobile";
  if (/\b(api|rest|webservice|ws\.|token|endpoint)\b/.test(lower)) return "api";
  return "web";
}

/**
 * Detect "create/generate custom keyword" authoring requests (not test-case steps).
 */
export function detectCreateKeywordIntent(raw: string): CreateKeywordIntent | null {
  const s = raw.trim();
  if (!s || !CREATE_KEYWORD_PHRASE.test(s)) return null;

  let confidence = 78;
  if (/\b(?:create|generate)\s+(?:katalon\s+)?(?:custom\s+)?keyword/i.test(s)) confidence = 92;
  if (/\bkeyword\s+class\s+for\b/i.test(s)) confidence = 95;
  if (/\b(?:custom|reusable)\s+keyword\s+for\b/i.test(s)) confidence = 90;

  const subject = extractKeywordCreateSubject(s);
  if (!subject) {
    confidence -= 35;
  } else {
    confidence += 8;
  }

  confidence = Math.min(100, Math.max(0, confidence));
  if (confidence < CONFIDENCE_THRESHOLD) return null;

  return {
    raw: s,
    confidence,
    subject: subject ?? "Custom",
    platform: detectKeywordTemplatePlatform(s),
  };
}

export function isCreateKeywordPhrase(raw: string): boolean {
  return CREATE_KEYWORD_PHRASE.test(raw.trim());
}

export const KEYWORD_CREATE_CONFIDENCE_THRESHOLD = CONFIDENCE_THRESHOLD;
