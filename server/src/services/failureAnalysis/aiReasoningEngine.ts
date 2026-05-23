import { gosiBrainGenerate, stripGosiBrainCoT, GosiBrainAuthError } from "../gosiBrain.js";
import { isGosiBrainConfigured } from "../../loadEnv.js";
import type { FailureAnalysisResult } from "./types.js";

const SYSTEM_RULES = `You are a Senior Katalon Studio Automation Engineer reviewing a Katalon test failure (WebUI, Mobile, or API/Web Service keywords).
Rules:
- Analyze ONLY as a Katalon project failure: Object Repository, Custom Keywords, WebUI/Mobile/WS built-ins, Groovy scripts, profiles, listeners.
- Execution logs alone are sufficient: infer root cause from step sequence, FAILED lines, waits, retries, and timing — do NOT ask for screenshots or stacktraces.
- Do NOT suggest Playwright, Cypress, Selenium raw scripts, or non-Katalon frameworks unless the evidence explicitly shows them.
- Base conclusions ONLY on the evidence provided (Katalon logs, stacktrace, console, API response).
- Do NOT invent log lines, HTTP status codes, or test object names not present in the evidence.
- If evidence is insufficient, say so explicitly and lower confidence.
- Output valid JSON only with keys: rootCause, rootCauseSummary, secondaryFactors (array), architectureInsights (array), suggestedFixTitles (array of strings), uncertainty (string or null).
- Be specific about WHY it failed and HOW to fix it using Katalon patterns (findTestObject, WebUI.waitForElementVisible, CustomKeywords, FailureHandling, etc.).`;

export async function enhanceWithAiReasoning(
  draft: FailureAnalysisResult,
  evidenceBundle: string,
  opts: { authorizationToken?: string; model?: string }
): Promise<Partial<FailureAnalysisResult> & { aiEnhanced: boolean }> {
  if (!isGosiBrainConfigured()) {
    return { aiEnhanced: false };
  }

  const token =
    opts.authorizationToken?.trim() || process.env.GOSI_BRAIN_AUTHORIZATION_TOKEN?.trim();
  if (!token) {
    return { aiEnhanced: false, uncertainty: "Gosi Brain not authenticated — using rule-based analysis only." };
  }

  const prompt = `${SYSTEM_RULES}

CURRENT DRAFT ANALYSIS:
${JSON.stringify(
  {
    failureType: draft.failureType,
    rootCause: draft.rootCause,
    flakyProbability: draft.flakyProbability,
    confidence: draft.confidence,
  },
  null,
  2
)}

EVIDENCE:
${evidenceBundle.slice(0, 12000)}

Improve the root cause narrative and fixes. Return JSON only.`;

  try {
    const { response } = await gosiBrainGenerate({
      prompt,
      model: opts.model,
      authorizationToken: token,
      temperature: 0.2,
    });
    const cleaned = stripGosiBrainCoT(response);
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { aiEnhanced: false };

    const parsed = JSON.parse(jsonMatch[0]) as {
      rootCause?: string;
      rootCauseSummary?: string;
      secondaryFactors?: string[];
      architectureInsights?: string[];
      suggestedFixTitles?: string[];
      uncertainty?: string | null;
    };

    const extraFixes =
      parsed.suggestedFixTitles?.map((title, i) => ({
        id: `ai-fix-${i}`,
        title,
        description: "Suggested by AI reasoning from provided evidence.",
        priority: "medium" as const,
        category: draft.failureType,
      })) ?? [];

    return {
      aiEnhanced: true,
      rootCause: parsed.rootCause ?? draft.rootCause,
      rootCauseSummary: parsed.rootCauseSummary ?? draft.rootCauseSummary,
      secondaryFactors: [
        ...draft.secondaryFactors,
        ...(parsed.secondaryFactors ?? []),
      ].slice(0, 10),
      architectureInsights: [
        ...draft.architectureInsights,
        ...(parsed.architectureInsights ?? []),
      ].slice(0, 8),
      suggestedFixes: [...draft.suggestedFixes, ...extraFixes].slice(0, 10),
      uncertainty: parsed.uncertainty ?? undefined,
    };
  } catch (e) {
    if (e instanceof GosiBrainAuthError) {
      return { aiEnhanced: false, uncertainty: e.message };
    }
    return { aiEnhanced: false, uncertainty: "AI enhancement unavailable; rule-based analysis used." };
  }
}
