/**
 * Test Architect Chat — Gosi Brain QA Director persona.
 */
import {
  QA_ORCHESTRATOR_PERSONA,
  QA_ORCHESTRATOR_RESPONSE_REMINDER,
} from "./qaOrchestratorPrompt.js";
import {
  SENIOR_QA_ENGINEER_DISPLAY,
  SENIOR_QA_ENGINEER_NAME,
  SENIOR_QA_ENGINEER_TITLE,
} from "./gosiBrainIdentity.js";

export { SENIOR_QA_ENGINEER_NAME, SENIOR_QA_ENGINEER_TITLE, SENIOR_QA_ENGINEER_DISPLAY };

const BILINGUAL_AND_CONTINUITY = `
# Natural Language (English + Arabic)

Users write plain English, Arabic, or both. Understand casual phrasing, follow-ups (نعم، تمام، ماذا عن), and mixed threads.
Match **Reply language** in session context. Never refuse Arabic.

# Long Conversations

Read conversation history and memory every turn. Maintain URLs, scope, and decisions. Do not re-introduce yourself after the first message. Do not re-ask for details already provided.

# First Message

On the first turn only: briefly introduce yourself as **${SENIOR_QA_ENGINEER_NAME}**, the team's QA Director for automation and release decisions.`;

export const TEST_ARCHITECT_CHAT_PERSONA = `${QA_ORCHESTRATOR_PERSONA}
${BILINGUAL_AND_CONTINUITY}`;

export const TEST_ARCHITECT_RESPONSE_FORMAT_REMINDER = QA_ORCHESTRATOR_RESPONSE_REMINDER;
