import {
  BILINGUAL_CONTEXT_REFERENCE_RE,
  BILINGUAL_DECISION_RE,
  BILINGUAL_FOLLOW_UP_RE,
  BILINGUAL_GENERATION_RE,
  BILINGUAL_PLATFORM_PATTERNS,
  BILINGUAL_TOPIC_PATTERNS,
  BILINGUAL_YES_RE,
} from "./bilingualText.js";
import { SENIOR_QA_ENGINEER_NAME } from "./testArchitectChatPrompt.js";
import type { WorkspaceSession } from "./types.js";

export type WorkspaceMessage = WorkspaceSession["messages"][number];

/** Recent turns kept verbatim (user + assistant pairs). */
export const LONG_CHAT_RECENT_MESSAGES = 32;
/** Max characters injected for full conversation context. */
export const LONG_CHAT_MAX_TOTAL_CHARS = 36_000;
/** Per-message cap in the recent window. */
export const LONG_CHAT_MAX_CHARS_PER_MESSAGE = 5000;
/** One-line digest length for older turns. */
const DIGEST_LINE_CHARS = 280;

const FOLLOW_UP_RE = BILINGUAL_FOLLOW_UP_RE;
const CONTEXT_REFERENCE_RE = BILINGUAL_CONTEXT_REFERENCE_RE;

const SHORT_REPLY_MAX = 160;

/** Short replies that only make sense with prior chat context. */
export function isConversationalFollowUp(message: string): boolean {
  const trimmed = message.trim();
  if (!trimmed) return false;
  if (CONTEXT_REFERENCE_RE.test(trimmed) && trimmed.length < 400) return true;
  if (trimmed.length > SHORT_REPLY_MAX && trimmed.split(/\n/).length > 3) return false;
  if (FOLLOW_UP_RE.test(trimmed)) return true;
  if (trimmed.length <= 56 && !BILINGUAL_GENERATION_RE.test(trimmed)) {
    return true;
  }
  return false;
}

export interface ConversationBrief {
  topics: string[];
  urls: string[];
  platforms: string[];
  userDecisions: string[];
}

export function extractConversationFacts(messages: WorkspaceMessage[]): ConversationBrief {
  const text = messages.map((m) => m.content).join("\n");
  const topics: string[] = [];
  const urls = [...new Set(text.match(/https?:\/\/[^\s)\]"']+/gi) ?? [])].slice(0, 8);
  const platforms: string[] = [];

  for (const [re, label] of BILINGUAL_PLATFORM_PATTERNS) {
    if (re.test(text) && !platforms.includes(label)) platforms.push(label);
  }

  for (const [re, label] of BILINGUAL_TOPIC_PATTERNS) {
    if (re.test(text) && !topics.includes(label)) topics.push(label);
  }

  const userDecisions: string[] = [];
  for (const m of messages.filter((x) => x.role === "user")) {
    const line = m.content.trim().replace(/\s+/g, " ");
    if (BILINGUAL_YES_RE.test(line) && line.length < 120) {
      userDecisions.push(line.slice(0, 120));
    }
    if (BILINGUAL_DECISION_RE.test(line)) {
      userDecisions.push(line.slice(0, 160));
    }
  }

  return {
    topics: topics.slice(0, 10),
    urls,
    platforms: [...new Set(platforms)],
    userDecisions: [...new Set(userDecisions)].slice(-12),
  };
}

export function formatConversationBrief(brief: ConversationBrief): string {
  const lines: string[] = [];
  if (brief.topics.length) lines.push(`Topics covered: ${brief.topics.join(", ")}`);
  if (brief.platforms.length) lines.push(`Platforms discussed: ${brief.platforms.join(", ")}`);
  if (brief.urls.length) lines.push(`URLs mentioned: ${brief.urls.join(", ")}`);
  if (brief.userDecisions.length) {
    lines.push("User confirmations/decisions:");
    for (const d of brief.userDecisions) lines.push(`- ${d}`);
  }
  return lines.join("\n");
}

function digestOlderMessages(messages: WorkspaceMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role === "user" ? "User" : SENIOR_QA_ENGINEER_NAME;
      const oneLine = m.content.trim().replace(/\s+/g, " ");
      const preview =
        oneLine.length > DIGEST_LINE_CHARS
          ? `${oneLine.slice(0, DIGEST_LINE_CHARS)}…`
          : oneLine;
      return `- ${role}: ${preview}`;
    })
    .join("\n");
}

export function formatConversationHistoryForPrompt(
  messages: WorkspaceMessage[],
  maxMessages = LONG_CHAT_RECENT_MESSAGES,
  maxCharsPerMessage = LONG_CHAT_MAX_CHARS_PER_MESSAGE
): string {
  if (!messages.length) return "";
  return messages
    .slice(-maxMessages)
    .map((m) => {
      const role = m.role === "user" ? "User" : SENIOR_QA_ENGINEER_NAME;
      let content = m.content.trim();
      if (content.length > maxCharsPerMessage) {
        content = `${content.slice(0, maxCharsPerMessage)}… [message truncated]`;
      }
      return `${role}: ${content}`;
    })
    .join("\n\n");
}

/** Tiered history for long English conversations — digest older turns, keep recent turns verbatim. */
export function buildConversationHistoryForPrompt(
  messages: WorkspaceMessage[],
  brief?: ConversationBrief
): string {
  if (!messages.length) return "";

  const facts = brief ?? extractConversationFacts(messages);
  const briefBlock = formatConversationBrief(facts);
  const recentCount = LONG_CHAT_RECENT_MESSAGES;
  const older = messages.length > recentCount ? messages.slice(0, -recentCount) : [];
  const recent = messages.slice(-recentCount);

  const parts: string[] = [];
  if (briefBlock) {
    parts.push(`## Conversation memory (carry forward — do not re-ask)\n${briefBlock}`);
  }
  if (older.length > 0) {
    parts.push(
      `## Earlier conversation (${older.length} older messages — digest)\n${digestOlderMessages(older)}`
    );
  }
  parts.push(`## Recent conversation (verbatim)\n${formatConversationHistoryForPrompt(recent)}`);

  let result = parts.join("\n\n");
  if (result.length > LONG_CHAT_MAX_TOTAL_CHARS) {
    result = `${result.slice(0, LONG_CHAT_MAX_TOTAL_CHARS)}\n… [conversation history trimmed to fit model context]`;
  }
  return result;
}

/** Combine recent chat so intent routing understands English follow-ups in long threads. */
export function buildRoutingMessage(message: string, history: WorkspaceMessage[]): string {
  const trimmed = message.trim();
  if (!history.length) return trimmed;

  const contextWindow = history.length > 12 ? 24 : 12;

  const recentUser = history
    .filter((m) => m.role === "user")
    .slice(-3)
    .map((m) => m.content.trim())
    .filter(Boolean);

  if (isConversationalFollowUp(trimmed) || CONTEXT_REFERENCE_RE.test(trimmed)) {
    const prior = history
      .slice(-contextWindow)
      .map((m) =>
        `${m.role === "user" ? "User" : SENIOR_QA_ENGINEER_NAME}: ${m.content.trim()}`
      )
      .join("\n");
    return `${prior}\nUser: ${trimmed}`;
  }

  if (recentUser.length && CONTEXT_REFERENCE_RE.test(trimmed)) {
    return `${recentUser.join("\n")}\n${trimmed}`;
  }

  if (history.length >= 8) {
    const prior = history
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.trim().slice(0, 500)}`)
      .join("\n");
    return `${prior}\nUser: ${trimmed}`;
  }

  return trimmed;
}

export function expandMessageWithHistory(message: string, history: WorkspaceMessage[]): string {
  if (!history.length || !isConversationalFollowUp(message)) return message;
  const prior = formatConversationHistoryForPrompt(history.slice(-16));
  return `${prior}\n\nUser (latest message): ${message.trim()}`;
}

export function mergeConversationBrief(
  existing: ConversationBrief | undefined,
  messages: WorkspaceMessage[]
): ConversationBrief {
  const fresh = extractConversationFacts(messages);
  if (!existing) return fresh;
  return {
    topics: [...new Set([...existing.topics, ...fresh.topics])].slice(0, 12),
    urls: [...new Set([...existing.urls, ...fresh.urls])].slice(0, 10),
    platforms: [...new Set([...existing.platforms, ...fresh.platforms])],
    userDecisions: [...new Set([...existing.userDecisions, ...fresh.userDecisions])].slice(-16),
  };
}
