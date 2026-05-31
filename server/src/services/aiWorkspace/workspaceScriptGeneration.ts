import { BILINGUAL_GENERATION_RE } from "./bilingualText.js";
import {
  hasActionableGenerationInput,
  isVagueGenerationRequest,
} from "./generationReadiness.js";
import { looksLikeTestStepLine } from "../testDsl/groovyUtilityIntent.js";
import type { WorkspaceContextPayload } from "./types.js";
import type { WorkspaceMessage } from "./conversationHistory.js";
import type { RoutedIntent } from "./intentRouter.js";
import { isProjectReviewRequest } from "./intentRouter.js";
import type { UserGenerationMode } from "../groovyGenerator/generationModeRouter.js";

const EXPLICIT_GENERATE_RE =
  /\b(generate (the )?(script|code|groovy|keyword|class|helper|page object)|write (the )?(groovy|script|keyword|class)|produce (the )?script|now generate|go ahead and (generate|write))\b/i;

const EXPLICIT_GENERATE_AR =
  /(ولّد|ولد|اكتب|أنشئ|انشئ).*(السكربت|سكريبت|الكود|كود|Groovy|كلمة|كيورد|كلاس)/i;

const GENERATION_VERB =
  /\b(create|generate|write|build|automate|make|develop|draft|produce)\b/i;

/** Infer Manual-tab code output type purely from chat text (English + Arabic). */
const MODE_PATTERNS: Array<{ mode: UserGenerationMode; re: RegExp }> = [
  { mode: "page_object", re: /\b(page object|pageobject|page-object|\bpom\b|كائن صفحة|كائن الصفحة)\b/i },
  {
    mode: "custom_keyword",
    re: /\b(custom keyword|@Keyword|keyword class|keyword for|كيورد|كلمة مفتاحية|كلمة مفتاح)\b/i,
  },
  {
    mode: "framework_service",
    re: /\b(framework service|service class for framework|خدمة framework|خدمة الإطار)\b/i,
  },
  { mode: "framework_helper", re: /\b(framework helper|helper class|مساعد framework|مساعد الإطار)\b/i },
  { mode: "api_helper", re: /\b(api helper|rest helper|api utility|مساعد api|مساعد واجهة)\b/i },
  {
    mode: "db_utility",
    re: /\b(db utility|database utility|sql utility|db helper|مساعد قاعدة|قاعدة البيانات)\b/i,
  },
  {
    mode: "groovy_function",
    re: /\b(groovy function|reusable function|function for|دالة groovy|دالة قابلة)\b/i,
  },
  { mode: "utility_class", re: /\b(utility class|utilities class|كلاس utility|كلاس مساعد)\b/i },
  {
    mode: "test_script",
    re: /\b(test script|test case|e2e test|automated test|automation script|سكربت اختبار|سكريبت اختبار|حالة اختبار)\b/i,
  },
];

function recentUserText(history: WorkspaceMessage[], limit = 6): string {
  return history
    .filter((h) => h.role === "user")
    .slice(-limit)
    .map((h) => h.content)
    .join("\n");
}

export function inferCodeGenerationModeFromText(text: string): UserGenerationMode | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  for (const { mode, re } of MODE_PATTERNS) {
    if (re.test(trimmed)) return mode;
  }
  return null;
}

/** Latest user message wins; fall back to recent chat history. */
export function resolveCodeGenerationMode(
  message: string,
  history: WorkspaceMessage[] = []
): UserGenerationMode {
  const fromMessage = inferCodeGenerationModeFromText(message);
  if (fromMessage) return fromMessage;

  const fromHistory = inferCodeGenerationModeFromText(recentUserText(history));
  if (fromHistory) return fromHistory;

  return "auto";
}

function extractUrlFromText(text: string): string | undefined {
  const m = text.match(/https?:\/\/[^\s)\]"']+/i);
  return m?.[0];
}

function extractLocatorsFromText(text: string): string | undefined {
  const lines = text
    .split(/\n/)
    .map((s) => s.trim())
    .filter((line) => /[#\[@]|xpath|css\s*=|findTestObject|data-testid|name\s*=|id\s*=/i.test(line));
  return lines.length ? lines.join("\n") : undefined;
}

/** Pull URL / locators mentioned in chat when context panel fields are empty. */
export function enrichPayloadFromChat(
  message: string,
  history: WorkspaceMessage[],
  payload: WorkspaceContextPayload
): WorkspaceContextPayload {
  const combined = `${recentUserText(history)}\n${message}`;
  return {
    ...payload,
    pageUrl: payload.pageUrl ?? extractUrlFromText(combined),
    locators: payload.locators ?? extractLocatorsFromText(combined),
  };
}

export function collectGenerationSteps(
  message: string,
  history: WorkspaceMessage[] = []
): string[] {
  const fromMessage = message.split(/\n/).map((s) => s.trim()).filter(Boolean);
  const mode = resolveCodeGenerationMode(message, history);

  if (
    mode !== "auto" &&
    mode !== "test_script" &&
    fromMessage.length >= 1 &&
    GENERATION_VERB.test(message)
  ) {
    return fromMessage;
  }

  if (hasActionableGenerationInput(message, fromMessage, {})) {
    return fromMessage;
  }

  const fromHistory: string[] = [];
  for (const m of history.filter((h) => h.role === "user").slice(-8)) {
    for (const line of m.content.split(/\n/).map((s) => s.trim()).filter(Boolean)) {
      if (looksLikeTestStepLine(line) || /[#\[@]|https?:\/\//i.test(line)) {
        fromHistory.push(line);
      }
    }
  }
  if (fromHistory.length >= 2) return [...new Set(fromHistory)];

  return fromMessage;
}

function isArchitecturalMode(mode: UserGenerationMode): boolean {
  return (
    mode === "page_object" ||
    mode === "custom_keyword" ||
    mode === "groovy_function" ||
    mode === "utility_class" ||
    mode === "framework_helper" ||
    mode === "api_helper" ||
    mode === "db_utility" ||
    mode === "framework_service"
  );
}

export function wantsKatalonScriptGeneration(
  route: RoutedIntent,
  message: string,
  steps: string[],
  payload: WorkspaceContextPayload,
  history: WorkspaceMessage[] = []
): boolean {
  if (isProjectReviewRequest(message) && route.intent === "analyze") return false;
  if (route.intent === "performance") return false;

  const mode = resolveCodeGenerationMode(message, history);
  const asksForCode =
    route.intent === "generate" ||
    BILINGUAL_GENERATION_RE.test(message) ||
    mode !== "auto" ||
    GENERATION_VERB.test(message);

  if (!asksForCode) return false;

  if (EXPLICIT_GENERATE_RE.test(message) || EXPLICIT_GENERATE_AR.test(message)) {
    if (isArchitecturalMode(mode)) return message.trim().length >= 12;
    return hasActionableGenerationInput(message, steps, payload) || steps.length >= 2;
  }

  if (isArchitecturalMode(mode) && GENERATION_VERB.test(message) && message.trim().length >= 15) {
    return true;
  }

  if (isVagueGenerationRequest(message) && !hasActionableGenerationInput(message, steps, payload)) {
    return false;
  }

  return hasActionableGenerationInput(message, steps, payload);
}

export function groovyAssetTitle(mode: UserGenerationMode): string {
  switch (mode) {
    case "custom_keyword":
      return "Generated Custom Keyword";
    case "page_object":
      return "Generated Page Object";
    case "utility_class":
      return "Generated Utility Class";
    case "framework_helper":
      return "Generated Framework Helper";
    case "groovy_function":
      return "Generated Groovy Function";
    case "api_helper":
      return "Generated API Helper";
    case "db_utility":
      return "Generated DB Utility";
    case "framework_service":
      return "Generated Framework Service";
    case "test_script":
      return "Generated Test Script";
    default:
      return "Generated Groovy";
  }
}
