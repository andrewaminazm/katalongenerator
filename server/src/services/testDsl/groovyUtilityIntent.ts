export type GroovyUtilityKind =
  | "generateFunction"
  | "generateUtility"
  | "generateHelper"
  | "generateClass"
  | "generateService"
  | "generateValidator"
  | "generateFrameworkComponent";

export type GroovyUtilityPlatform = "web" | "mobile" | "api" | "utility";

export interface GroovyUtilityIntent {
  raw: string;
  confidence: number;
  kind: GroovyUtilityKind;
  subject: string;
  platform: GroovyUtilityPlatform;
}

const UTILITY_PHRASE =
  /\b(?:(?:create|generate|make|build)\s+(?:a\s+)?(?:[\w]+\s+){0,14}(?:function|utility|utilities|helper|helpers|method|class|service|validator|manager|formatter|parser|builder)|(?:utility|helper)\s+class|(?:reusable\s+)?(?:function|method)\s+for|framework\s+(?:helper|component|service)|(?:[\w\s]+)\butility\b)/i;

/** Must not route keyword-create lines here */
const KEYWORD_GUARD =
  /\b(?:custom\s+)?keywords?\b/i;

const CONFIDENCE_THRESHOLD = 70;

function cleanSubject(fragment: string): string {
  return fragment
    .replace(
      /\b(with|using|that|on|in|the|a|an|for|groovy|katalon|reusable|utility|helper|function|method|class|web|mobile|api)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function extractGroovyUtilitySubject(raw: string): string | undefined {
  const s = raw.trim();
  const patterns = [
    /\b(?:function|utility|helper|method|class|service|validator|manager)\s+for\s+(.+)$/i,
    /\b(?:create|generate|make)\s+(?:[\w]+\s+){0,10}for\s+(.+)$/i,
    /\bfor\s+(.+)$/i,
    /\bto\s+(.+)$/i,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m?.[1]) {
      const sub = cleanSubject(m[1]);
      if (sub.length >= 2) return sub;
    }
  }
  const inline = s.match(
    /\b(?:create|generate)\s+(?:a\s+)?(?:groovy\s+)?(?:utility\s+)?(?:function|method|helper)\s+(?:for\s+)?(.+)$/i
  );
  if (inline?.[1]) {
    const sub = cleanSubject(inline[1]);
    if (sub.length >= 2) return sub;
  }
  const helperTail = s.match(
    /\b(?:create|generate|make)\s+(?:a\s+)?(?:reusable\s+)?(?:katalon\s+)?(?:(?:groovy|custom)\s+)?(?:\w+\s+)*?(\w+(?:\s+\w+)*?)\s+helper\b/i
  );
  if (helperTail?.[1]) {
    const sub = cleanSubject(helperTail[1]);
    if (sub.length >= 2) return sub;
  }
  const utilityTail = s.match(/\b(?:create|generate|make)\s+(?:a\s+)?([\w\s]+?)\s+utility\b/i);
  if (utilityTail?.[1]) {
    const sub = cleanSubject(utilityTail[1]);
    if (sub.length >= 2) return sub;
  }
  return undefined;
}

export function classifyGroovyUtilityKind(raw: string): GroovyUtilityKind {
  const lower = raw.toLowerCase();
  if (/\bvalidator\b/.test(lower)) return "generateValidator";
  if (/\bservice\b/.test(lower)) return "generateService";
  if (/\b(?:framework|component)\b/.test(lower)) return "generateFrameworkComponent";
  if (/\b(?:utility|utilities)\b/.test(lower)) return "generateUtility";
  if (/\b(?:helper|helpers)\b/.test(lower)) return "generateHelper";
  if (/\bclass\b/.test(lower)) return "generateClass";
  if (/\bfunction\b/.test(lower)) return "generateFunction";
  return "generateUtility";
}

export function detectGroovyUtilityPlatform(raw: string): GroovyUtilityPlatform {
  const lower = raw.toLowerCase();
  if (/\b(mobile|appium|android|ios)\b/.test(lower)) return "mobile";
  if (/\b(api|rest|webservice|ws\.|token|endpoint|requestobject)\b/.test(lower)) return "api";
  if (/\b(webui|browser|screenshot|scroll|xpath|element)\b/.test(lower)) return "web";
  if (/\b(database|excel|json|file|encryption|faker|date|email|retry|string)\b/.test(lower)) {
    return "utility";
  }
  return "utility";
}

export function detectGroovyUtilityIntent(raw: string): GroovyUtilityIntent | null {
  const s = raw.trim();
  if (!s || !UTILITY_PHRASE.test(s) || KEYWORD_GUARD.test(s)) return null;

  let confidence = 76;
  if (/\b(?:create|generate)\s+(?:groovy\s+)?(?:function|utility|helper)\b/i.test(s)) confidence = 90;
  if (/\b(?:utility|helper)\s+class\b/i.test(s)) confidence = 88;
  if (/\breusable\s+(?:function|method)\b/i.test(s)) confidence = 92;

  const subject = extractGroovyUtilitySubject(s);
  if (!subject) confidence -= 32;
  else confidence += 10;

  confidence = Math.min(100, Math.max(0, confidence));
  if (confidence < CONFIDENCE_THRESHOLD) return null;

  return {
    raw: s,
    confidence,
    kind: classifyGroovyUtilityKind(s),
    subject: subject ?? "Custom",
    platform: detectGroovyUtilityPlatform(s),
  };
}

/** Test-case step signals — prefer test compiler when dominant */
export function looksLikeTestStepLine(raw: string): boolean {
  const s = raw.trim().toLowerCase();
  if (!s) return false;
  if (/^\d+\s*[-.)]\s*/.test(s)) return true;
  if (/\b(click|tap|verify|assert|visit|navigate|open browser|type|enter|select)\b/.test(s)) return true;
  if (/^use keyword\b/.test(s)) return true;
  return false;
}

export const GROOVY_UTILITY_CONFIDENCE_THRESHOLD = CONFIDENCE_THRESHOLD;
