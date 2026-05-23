import {
  detectGroovyUtilityIntent,
  type GroovyUtilityIntent,
} from "../testDsl/groovyUtilityIntent.js";
import type { ArchitectureComponentKind, ArchitectureFeatures, ArchitectureIntent } from "./types.js";
import { toPascalCase } from "../groovyGenerator/groovyBestPractices.js";

const ARCHITECTURE_PHRASE =
  /\b(?:create|generate|make|build)\s+(?:a\s+)?(?:reusable\s+)?(?:[\w]+\s+){0,12}(?:helper|utility|utilities|function|class|service|validator|manager|page\s*object|framework|component|keyword)|(?:page\s*object|api\s+helper|db\s+utility|framework\s+service|reusable\s+login)\b/i;

function detectFeatures(raw: string): ArchitectureFeatures {
  const lower = raw.toLowerCase();
  return {
    retry: /\bretry\b/.test(lower),
    screenshot: /\bscreenshot\b/.test(lower),
    logging: /\b(log|logging|logger)\b/.test(lower),
    sessionValidation: /\b(session|logged\s*in|authentication\s+state)\b/.test(lower),
    waits: /\b(wait|timeout)\b/.test(lower),
    exceptions: true,
  };
}

function detectKind(raw: string, utility: GroovyUtilityIntent): ArchitectureComponentKind {
  const lower = raw.toLowerCase();
  if (/\bpage\s*object\b/.test(lower) || /\bpage\b/.test(lower) && /\bobject\b/.test(lower)) {
    return "page_object";
  }
  if (/\b(api|rest|webservice|ws\.|token|endpoint)\b/.test(lower)) return "api_helper";
  if (/\b(database|db|jdbc|sql|query)\b/.test(lower)) return "db_utility";
  if (/\b(framework\s+service|environment\s+manager|config\s+loader|session\s+manager)\b/.test(lower)) {
    return "framework_service";
  }
  if (/\b(keyword|@keyword)\b/.test(lower) && !/\bhelper\b/.test(lower)) return "custom_keyword";
  if (/\b(random|faker|email|json|data)\b/.test(lower) && /\b(generat|util|function)\b/.test(lower)) {
    return "data_generator";
  }
  if (/\b(login|helper|retry|screenshot|browser|popup|wait)\b/.test(lower)) {
    return "reusable_helper";
  }
  if (utility.kind === "generateHelper" || utility.kind === "generateFrameworkComponent") {
    return "reusable_helper";
  }
  return "generic_utility";
}

export function analyzeArchitecturePrompt(raw: string): ArchitectureIntent | null {
  const utility = detectGroovyUtilityIntent(raw);
  if (!utility && !ARCHITECTURE_PHRASE.test(raw.trim())) return null;
  if (!utility) {
    const fallback: GroovyUtilityIntent = {
      raw: raw.trim(),
      confidence: 72,
      kind: "generateHelper",
      subject: raw.trim().slice(0, 80),
      platform: "web",
    };
    const features = detectFeatures(raw);
    return {
      raw: raw.trim(),
      confidence: 72,
      kind: detectKind(raw, fallback),
      subject: fallback.subject,
      platform: fallback.platform,
      features,
      utilityIntent: fallback,
    };
  }

  const features = detectFeatures(raw);
  let confidence = utility.confidence;
  if (features.retry || features.sessionValidation) confidence += 5;
  if (/\breusable\b/.test(raw.toLowerCase())) confidence += 4;

  return {
    raw: utility.raw,
    confidence: Math.min(100, confidence),
    kind: detectKind(raw, utility),
    subject: utility.subject,
    platform: utility.platform,
    features,
    utilityIntent: utility,
  };
}

export function inferArchitectureClassName(kind: ArchitectureComponentKind, subject: string): string {
  if (kind === "reusable_helper" && /\blogin\b/i.test(`${subject}`)) {
    return "LoginHelper";
  }
  const base = toPascalCase(subject.replace(/\b(reusable|helper|utility|with|and|retry|session|validation)\b/gi, " ").trim());
  switch (kind) {
    case "page_object":
      return base.endsWith("Page") ? base : `${base}Page`;
    case "api_helper":
      return base.endsWith("Service") || base.endsWith("Client") ? base : `${base}ApiClient`;
    case "db_utility":
      return base.endsWith("Utils") ? base : `${base}DbUtils`;
    case "framework_service":
      return base.endsWith("Manager") || base.endsWith("Service") ? base : `${base}Manager`;
    default:
      return base.endsWith("Helper") ? base : `${base}Helper`;
  }
}
