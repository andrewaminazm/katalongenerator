const DEFAULT_BASE = "http://localhost:11434";

export interface OllamaGenerateOptions {
  baseUrl?: string;
  model: string;
  prompt: string;
  stream?: boolean;
}

export interface OllamaGenerateResult {
  response: string;
  model: string;
  done: boolean;
}

function getBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || DEFAULT_BASE;
}

/**
 * Calls Ollama HTTP API: POST /api/generate
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md
 */
export async function generateWithOllama(
  options: OllamaGenerateOptions
): Promise<OllamaGenerateResult> {
  const { model, prompt, stream = false } = options;
  const baseUrl = options.baseUrl || getBaseUrl();
  const url = `${baseUrl}/api/generate`;

  const body = {
    model,
    prompt,
    stream: false,
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama request failed: ${res.status} ${res.statusText}${text ? ` — ${text.slice(0, 500)}` : ""}`
    );
  }

  const data = (await res.json()) as {
    response?: string;
    model?: string;
    done?: boolean;
  };

  return {
    response: data.response ?? "",
    model: data.model ?? model,
    done: data.done ?? true,
  };
}

/**
 * Streaming: yields text chunks from Ollama (stream: true).
 */
export async function* streamOllama(
  options: OllamaGenerateOptions
): AsyncGenerator<string, void, unknown> {
  const { model, prompt } = options;
  const baseUrl = options.baseUrl || getBaseUrl();
  const url = `${baseUrl}/api/generate`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: true }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Ollama stream failed: ${res.status}${text ? ` — ${text.slice(0, 300)}` : ""}`
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
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed) as { response?: string };
          if (json.response) yield json.response;
        } catch {
          // ignore partial JSON lines
        }
      }
    }
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer.trim()) as { response?: string };
        if (json.response) yield json.response;
      } catch {
        /* noop */
      }
    }
  } finally {
    reader.releaseLock();
  }
}
