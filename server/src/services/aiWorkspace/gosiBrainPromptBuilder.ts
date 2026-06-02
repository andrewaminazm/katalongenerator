/**
 * Adaptive Gosi Brain prompt builder.
 *
 * Builds a proper system + history + user message array so Gosi Brain:
 * - Understands plain English and Arabic for any request type
 * - Returns a brief confirmation for code generation
 * - Returns a full analysis for analysis/advisory requests
 * - Returns a natural conversational reply for questions and greetings
 * - Maintains conversation context across turns
 */

import type { GosiBrainMessage } from "../gosiBrain.js";
import type { EnrichedWorkspaceContext } from "./contextManager.js";
import type { RoutedIntent } from "./intentRouter.js";
import type { WorkspaceSession } from "./types.js";
import { SENIOR_QA_ENGINEER_NAME } from "./gosiBrainIdentity.js";

// ─── System persona ───────────────────────────────────────────────────────────

const BASE_PERSONA = `You are **${SENIOR_QA_ENGINEER_NAME}**, an expert QA Director, Test Architect, and Automation Engineer for Katalon Studio.

You understand plain English and Arabic. Respond in the same language the user writes in.

## Your capabilities
- Generate production-grade Katalon Studio Groovy test scripts, custom keywords, page objects, API helpers, DB utilities, and framework helpers
- Analyze test execution reports and give release readiness decisions
- Review project quality, flakiness, coverage gaps, and automation architecture
- Answer any QA, testing, or automation question in plain English or Arabic
- Remember conversation context and prior messages — never re-ask for things already provided

## Behavior rules
1. **Always respond to what the user actually asked.** Do not force a 6-section analysis for a simple question or greeting.
2. **For code generation requests**: Briefly confirm what you are generating (1–2 sentences), then the code will appear below. Do NOT generate full Groovy yourself in the advisory response — the Katalon compiler handles code.
3. **For analysis/review requests**: Use the structured QA Director format with sections.
4. **For greetings / introductory messages**: Greet the user, briefly state your capabilities, and ask what they need.
5. **For questions**: Answer directly and helpfully, with examples where relevant.
6. **Never invent test metrics** if no execution data is provided.
7. **Never refuse Arabic.** Never say "I can only respond in English."
8. Sign substantive replies as — **${SENIOR_QA_ENGINEER_NAME}**`;

// ─── Intent-specific format guides ───────────────────────────────────────────

const FORMAT_ANALYSIS = `
## Response format for this analysis request
Use sections:
1. EXECUTIVE QA SUMMARY — status + rationale
2. KEY FINDINGS — ranked by severity (P0–P4)
3. RISKS — only P0 and P1
4. PRIORITIZED ACTION PLAN — numbered, business-impact order
5. (Optional) RECOMMENDATIONS

Be concise. No invented metrics. Sign as ${SENIOR_QA_ENGINEER_NAME}.`;

const FORMAT_GENERATION = `
## Response format for this code generation request
Write 1–3 sentences only:
- Confirm what is being generated (e.g. "Generating a test script to navigate to Google and verify the page loads…")
- Note any missing inputs if relevant (URL, locators, steps) so the user can add them for better results
- Do NOT paste Groovy code — the Katalon compiler generates it automatically

Be direct. No 6-section analysis. No invented metrics.`;

const FORMAT_QUESTION = `
## Response format for this question
Answer directly and helpfully. Use bullet points, numbered steps, or code examples where appropriate.
Keep the response focused on what was asked. No 6-section analysis unless the user asks for it.`;

const FORMAT_GREETING = `
## Response format for this greeting
Greet the user warmly. In 3–5 bullet points list what you can help with (code generation, test analysis, QA advisory, Arabic support). Ask what they want to work on. Keep it short.`;

// ─── Context block ────────────────────────────────────────────────────────────

function buildContextBlock(ctx: EnrichedWorkspaceContext): string {
  const parts: string[] = [];

  if (ctx.projectSummary) {
    parts.push(`## Project context\n${ctx.projectSummary}`);
  }
  if (ctx.aiMemoryInjection) {
    parts.push(`## AI Memory (coding style from prior generations)\n${ctx.aiMemoryInjection.slice(0, 1500)}`);
  }
  if (ctx.workspaceMemoryInjection) {
    parts.push(`## Workspace memory\n${ctx.workspaceMemoryInjection.slice(0, 1000)}`);
  }
  if (ctx.payload.pageUrl) {
    parts.push(`## Target URL\n${ctx.payload.pageUrl}`);
  }
  if (ctx.payload.platform) {
    parts.push(`## Platform: ${ctx.payload.platform}`);
  }
  const langMode = ctx.conversationLanguageMode;
  if (langMode) {
    parts.push(`## Reply language: ${langMode === "arabic" ? "Arabic (العربية)" : langMode === "mixed" ? "match user language" : "English"}`);
  }

  return parts.length ? parts.join("\n\n") : "";
}

// ─── History formatter ────────────────────────────────────────────────────────

function historyToMessages(
  history: WorkspaceSession["messages"] | undefined,
  limit = 10
): GosiBrainMessage[] {
  if (!history?.length) return [];
  return history
    .slice(-limit)
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        typeof m.content === "string"
          ? m.content.slice(0, 2000)
          : String(m.content).slice(0, 2000),
    }));
}

// ─── Intent classifier (local, no API) ───────────────────────────────────────

type GosiBrainIntent = "greeting" | "generation" | "analysis" | "question";

function classifyIntent(
  intent: RoutedIntent["intent"],
  message: string
): GosiBrainIntent {
  const lower = message.trim().toLowerCase();

  // Greeting / intro (intent type doesn't include "greet" — detect from text)
  if (
    /^(hi|hello|hey|مرحبا|أهلاً|هلا|السلام|صباح|مساء)[^a-z]*$/i.test(lower) ||
    lower.length < 15
  ) {
    return "greeting";
  }

  // Code generation
  if (
    intent === "generate" ||
    /\b(generate|create|write|build|automate|make)\b.*(script|test|keyword|class|helper|page.?object|api|groovy)/i.test(lower) ||
    /(ولد|أنشئ|اكتب|انشئ).*(سكريبت|كود|اختبار|كيورد)/i.test(message)
  ) {
    return "generation";
  }

  // Analysis / review / QA
  if (
    intent === "analyze" ||
    intent === "review" ||
    /\b(analyze|review|report|assess|risk|release|coverage|flaky|quality|readiness)\b/i.test(lower) ||
    /(تحليل|مراجعة|تقرير|جودة|مخاطر)/i.test(message)
  ) {
    return "analysis";
  }

  return "question";
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export interface BuildGosiBrainMessagesOptions {
  message: string;
  ctx: EnrichedWorkspaceContext;
  route: RoutedIntent;
  /** Whether the Katalon compiler will also generate Groovy for this request. */
  willGenerate: boolean;
  /** Extra evidence / supplementary context from project analyzers. */
  supplementaryContext?: string;
}

export function buildGosiBrainMessages(opts: BuildGosiBrainMessagesOptions): GosiBrainMessage[] {
  const { message, ctx, route, willGenerate, supplementaryContext } = opts;

  const gosiBrainIntent = willGenerate ? "generation" : classifyIntent(route.intent, message);

  // Build system message
  const contextBlock = buildContextBlock(ctx);
  const formatGuide =
    gosiBrainIntent === "greeting"
      ? FORMAT_GREETING
      : gosiBrainIntent === "generation"
        ? FORMAT_GENERATION
        : gosiBrainIntent === "analysis"
          ? FORMAT_ANALYSIS
          : FORMAT_QUESTION;

  const systemParts = [BASE_PERSONA];
  if (contextBlock) systemParts.push(contextBlock);
  if (supplementaryContext?.trim()) {
    systemParts.push(`## Evidence / Project data\n${supplementaryContext.slice(0, 6000)}`);
  }
  systemParts.push(formatGuide);

  const systemContent = systemParts.join("\n\n---\n\n");

  // Build conversation history
  const historyMessages = historyToMessages(ctx.historyMessages, 12);

  return [
    { role: "system", content: systemContent },
    ...historyMessages,
    { role: "user", content: message },
  ];
}
