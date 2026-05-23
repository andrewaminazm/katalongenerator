import type { AutomationIntentType, IntentAnalysis } from "./types.js";
import { detectCreateKeywordIntent } from "../testDsl/keywordCreateIntent.js";
import { detectGroovyUtilityIntent } from "../testDsl/groovyUtilityIntent.js";
import { analyzeArchitecturePrompt } from "../groovyArchitecture/architectureIntentAnalyzer.js";
import { looksLikeTestStepLine } from "../testDsl/groovyUtilityIntent.js";

function extractSubjects(raw: string): string[] {
  const subjects: string[] = [];
  const forM = raw.match(/\bfor\s+(.+?)(?:\s+with|\s+using|$)/i);
  if (forM?.[1]) subjects.push(forM[1].trim());
  const login = raw.match(/\b(login|checkout|dashboard|search)\b/gi);
  if (login) subjects.push(...login.map((s) => s.toLowerCase()));
  return [...new Set(subjects)];
}

function scoreIntent(
  type: AutomationIntentType,
  raw: string,
  lower: string
): number {
  switch (type) {
    case "locatorHealing":
      return /\b(heal|fix)\b.*\blocator\b/.test(lower) ? 90 : 0;
    case "flakyTestAnalysis":
      return /\b(flaky|intermittent|unstable)\b/.test(lower) ? 88 : 0;
    case "frameworkOptimization":
      return /\b(optimize|faster|performance|speed)\b/.test(lower) ? 85 : 0;
    case "frameworkRefactor":
      return /\b(refactor|convert|migrate|redesign)\b/.test(lower) ? 84 : 0;
    case "debugging":
      return /\b(debug|why|failing|failure|error|broken)\b/.test(lower) ? 82 : 0;
    case "codeReview":
      return /\b(review|audit|analyze code)\b/.test(lower) ? 80 : 0;
    case "projectAnalysis":
      return /\b(analyze|audit)\b.*\b(project|framework)\b/.test(lower) ? 86 : 0;
    case "conversationalAdvice":
      return /\b(what is wrong|how should|recommend|suggest|advice|explain)\b/.test(lower)
        ? 78
        : 0;
    case "pageObjectGeneration":
      return /\bpage\s*object\b/.test(lower) ? 90 : 0;
    case "apiGeneration":
      return /\b(api|rest|token|webservice)\b/.test(lower) && /\b(helper|util|generat)\b/.test(lower)
        ? 85
        : 0;
    case "dbUtilityGeneration":
      return /\b(database|db|jdbc|sql)\b/.test(lower) ? 85 : 0;
    case "keywordGeneration":
      return detectCreateKeywordIntent(raw) ? 92 : /\b(keyword)\b/.test(lower) ? 70 : 0;
    case "utilityGeneration":
      return detectGroovyUtilityIntent(raw) || analyzeArchitecturePrompt(raw) ? 88 : 0;
    case "testGeneration":
      return looksLikeTestStepLine(raw) || /\b(test|click|verify|visit|navigate)\b/.test(lower)
        ? 75
        : 0;
    case "frameworkArchitecture":
      return /\b(architecture|framework)\b/.test(lower) ? 72 : 0;
    default:
      return 0;
  }
}

export function analyzeIntent(prompt: string, steps?: string[]): IntentAnalysis {
  const raw = prompt.trim() || (steps ?? []).join("\n");
  const lower = raw.toLowerCase();
  const lines = steps?.length ? steps : raw.split(/\n/).map((s) => s.trim()).filter(Boolean);

  const scores: { type: AutomationIntentType; score: number }[] = [
    "testGeneration",
    "keywordGeneration",
    "utilityGeneration",
    "pageObjectGeneration",
    "apiGeneration",
    "dbUtilityGeneration",
    "frameworkArchitecture",
    "frameworkRefactor",
    "frameworkOptimization",
    "flakyTestAnalysis",
    "locatorHealing",
    "debugging",
    "codeReview",
    "performanceAnalysis",
    "migration",
    "conversationalAdvice",
    "projectAnalysis",
  ].map((type) => ({
    type: type as AutomationIntentType,
    score: scoreIntent(type as AutomationIntentType, raw, lower),
  }));

  scores.sort((a, b) => b.score - a.score);
  let primary = scores[0]?.type ?? "unknown";
  let confidence = scores[0]?.score ?? 30;

  const utilityHit = detectGroovyUtilityIntent(raw);
  const keywordHit = detectCreateKeywordIntent(raw);
  const testHits = lines.filter((l) => looksLikeTestStepLine(l) && !utilityHit && !keywordHit);

  const secondary: AutomationIntentType[] = [];
  if (utilityHit && testHits.length > 0) {
    primary = "mixedIntent";
    confidence = Math.min(95, (utilityHit.confidence + 70) / 2);
    secondary.push("utilityGeneration", "testGeneration");
  } else if (/\band\b/.test(lower)) {
    const top2 = scores.filter((s) => s.score >= 60).slice(0, 3);
    if (top2.length >= 2) {
      primary = "mixedIntent";
      secondary.push(...top2.map((s) => s.type));
    }
  }

  const ambiguous = confidence < 55 || (scores[0]?.score ?? 0) - (scores[1]?.score ?? 0) < 12;
  const complexity =
    lines.length > 4 || primary === "mixedIntent" || primary === "frameworkRefactor"
      ? "high"
      : lines.length > 1 || secondary.length > 0
        ? "medium"
        : "low";

  let clarifyingQuestion: string | undefined;
  if (ambiguous && confidence < 50) {
    clarifyingQuestion =
      "Do you want a test script, a reusable helper/utility, a custom keyword, or framework analysis?";
  }

  return {
    primary,
    secondary,
    confidence: Math.min(100, confidence) / 100,
    ambiguous,
    complexity,
    entities: {
      subjects: extractSubjects(raw),
      mentionsRetry: /\bretry\b/.test(lower),
      mentionsScreenshot: /\bscreenshot\b/.test(lower),
      mentionsSession: /\bsession\b/.test(lower),
      mentionsPageObject: /\bpage\s*object\b/.test(lower),
      mentionsApi: /\b(api|rest|token)\b/.test(lower),
      mentionsDb: /\b(database|db|jdbc)\b/.test(lower),
      mentionsFlaky: /\b(flaky|intermittent)\b/.test(lower),
      mentionsPerformance: /\b(faster|performance|optimize)\b/.test(lower),
      mentionsLogin: /\blogin\b/.test(lower),
    },
    clarifyingQuestion,
    raw,
  };
}
