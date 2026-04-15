const GEMINI_API_ROOT = "https://generativelanguage.googleapis.com/v1beta";

export interface GeminiGenerateOptions {
  model: string;
  prompt: string;
  apiKey: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GeminiGenerateResult {
  response: string;
  model: string;
}

function normalizeModelId(model: string): string {
  const m = model.trim();
  if (!m) return "gemini-2.0-flash";
  if (m.startsWith("models/")) return m.slice("models/".length);
  return m;
}

function extractTextFromGenerateContentPayload(data: unknown): string {
  const root = data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
    error?: { message?: string; code?: number };
  };
  if (root.error?.message) {
    throw new Error(`Gemini API: ${root.error.message}`);
  }
  const parts = root.candidates?.[0]?.content?.parts;
  if (!parts?.length) {
    const reason = root.candidates?.[0]?.finishReason;
    throw new Error(
      reason
        ? `Gemini returned no text (finishReason: ${reason}).`
        : "Gemini returned no candidates or text."
    );
  }
  return parts.map((p) => p.text ?? "").join("");
}

/**
 * Google AI Gemini generateContent (REST).
 * @see https://ai.google.dev/api/rest/v1beta/models/generateContent
 */
export async function generateWithGemini(
  options: GeminiGenerateOptions
): Promise<GeminiGenerateResult> {
  const model = normalizeModelId(options.model);
  const { prompt, apiKey } = options;
  const url = `${GEMINI_API_ROOT}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const raw = await res.text().catch(() => "");
  if (!res.ok) {
    let msg = `Gemini request failed: ${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } };
      if (j.error?.message) msg = `Gemini: ${j.error.message}`;
    } catch {
      if (raw) msg += ` — ${raw.slice(0, 400)}`;
    }
    throw new Error(msg);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }

  const text = extractTextFromGenerateContentPayload(data);
  return { response: text, model };
}

/**
 * Streaming via streamGenerateContent + SSE (alt=sse).
 */
export async function* streamGemini(
  options: GeminiGenerateOptions
): AsyncGenerator<string, void, unknown> {
  const model = normalizeModelId(options.model);
  const { prompt, apiKey } = options;
  const url = `${GEMINI_API_ROOT}/models/${encodeURIComponent(model)}:streamGenerateContent?key=${encodeURIComponent(apiKey)}&alt=sse`;

  const streamBody = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 8192,
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(streamBody),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Gemini stream failed: ${res.status}${text ? ` — ${text.slice(0, 400)}` : ""}`
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice("data:".length).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
          const parts = json.candidates?.[0]?.content?.parts;
          const chunk = parts?.map((p) => p.text ?? "").join("") ?? "";
          if (chunk) yield chunk;
        } catch {
          // ignore partial / non-JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
