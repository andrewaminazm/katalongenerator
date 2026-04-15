import { generateWithOllama } from "../ollama.js";
import { scoreHealingCandidate } from "./healingScorer.js";
import type { FallbackLocator, LocatorRef } from "./types.js";

const DEFAULT_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

function extractJsonArray(text: string): unknown {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : t;
  const arr = body.match(/\[[\s\S]*\]/);
  if (!arr) return null;
  try {
    return JSON.parse(arr[0]);
  } catch {
    return null;
  }
}

/**
 * Last-resort: ask Ollama for exactly 3 locator objects. Parsed and re-scored for ordering.
 */
export async function repairLocatorsWithOllama(options: {
  url: string;
  action: string;
  failedLocator: LocatorRef;
  domSnapshot?: string;
  model?: string;
}): Promise<FallbackLocator[]> {
  const model = options.model?.trim() || DEFAULT_MODEL;
  const snap = (options.domSnapshot ?? "").slice(0, 12_000);

  const prompt = `You are a test automation locator expert.

Fix this broken locator for a Katalon WebUI test (Groovy). Use stable strategies only — id, name, data-testid, short CSS, or relative XPath. No Selenium WebDriver code.

URL: ${options.url}
Action: ${options.action}
Failed locator type: ${options.failedLocator.type}
Failed locator value: ${options.failedLocator.value}
${snap ? `DOM snippet:\n${snap}\n` : ""}

Return ONLY a JSON array of exactly 3 objects (no markdown, no explanation):
[
  {"type":"name","value":"..."},
  {"type":"css","value":"..."},
  {"type":"xpath","value":"..."}
]

Rules:
- "type" must be one of: id, name, data-testid, css, xpath
- For id use value like "#myId" or raw id string
- For name use the attribute value only if type is name (generator will wrap as [name="..."] where needed)
- Prioritize stability over length.`;

  const { response } = await generateWithOllama({ model, prompt, stream: false });
  const parsed = extractJsonArray(response);
  if (!Array.isArray(parsed)) {
    return [];
  }

  const out: FallbackLocator[] = [];
  for (const row of parsed.slice(0, 5)) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const type = String(o.type ?? "").trim();
    const value = String(o.value ?? "").trim();
    if (!type || !value) continue;
    out.push({
      type,
      value,
      score: scoreHealingCandidate(type, value),
      source: "ai",
    });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, 3);
}
