/**
 * Gosi Brain (IWAI proxy) — OpenAI-compatible chat completions with extra gateway headers.
 */

export interface GosiBrainOptions {
  prompt: string;
  model?: string;
  temperature?: number;
  /** Full value for Authorization header, usually "Bearer eyJ..." */
  authorizationToken: string;
}

export class GosiBrainAuthError extends Error {
  readonly code = "GOSI_AUTH_ERROR" as const;

  constructor(message: string) {
    super(message);
    this.name = "GosiBrainAuthError";
  }
}

function base64UrlToUtf8(segment: string): string {
  let b64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  return Buffer.from(b64, "base64").toString("utf8");
}

/** Best-effort JWT exp check (does not verify signature). */
export function isBearerTokenExpired(authorizationHeader: string): boolean {
  const raw = authorizationHeader.replace(/^Bearer\s+/i, "").trim();
  const parts = raw.split(".");
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(base64UrlToUtf8(parts[1])) as { exp?: unknown };
    const exp = payload.exp;
    if (typeof exp !== "number") return false;
    return exp * 1000 <= Date.now();
  } catch {
    return false;
  }
}

/** Qwen chain-of-thought wrappers — strip before using Groovy output. */
export function stripGosiBrainCoT(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*?<\/redacted_thinking>/gi, "")
    .trim();
}

function normalizeAuthorizationHeader(token: string): string {
  const t = token.trim();
  if (/^Bearer\s+/i.test(t)) return t;
  return `Bearer ${t}`;
}

export async function gosiBrainGenerate(opts: GosiBrainOptions): Promise<{ response: string; model: string }> {
  const url = process.env.GOSI_BRAIN_CHAT_URL?.trim();
  const apiKey = process.env.GOSI_BRAIN_API_KEY?.trim();
  const modelDefault = process.env.GOSI_BRAIN_MODEL?.trim() ?? "qwen3-vl-30b-a3b-instruct-fp8";
  const maxTokens = Number(process.env.GOSI_BRAIN_MAX_TOKENS ?? 16000);

  if (!url) {
    throw new Error("GOSI_BRAIN_CHAT_URL is not set on the server.");
  }
  if (!apiKey) {
    throw new Error("GOSI_BRAIN_API_KEY is not set on the server.");
  }

  const authHeader = normalizeAuthorizationHeader(opts.authorizationToken);
  if (isBearerTokenExpired(authHeader)) {
    throw new GosiBrainAuthError(
      "The Gosi Brain authorization token appears expired (JWT exp). Refresh the token or open the app with ?token=..."
    );
  }

  const model = opts.model?.trim() || modelDefault;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "x-apikey": apiKey,
      "Content-Type": "application/json",
      "x-oauth-identity-domain-name": "MobileDomain",
      // WSO2 gateway rejects Brotli (415) — Node fetch advertises br by default
      "Accept-Encoding": "gzip, deflate",
      Accept: "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: opts.prompt }],
      temperature: opts.temperature ?? 0.7,
      max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 16000,
      stream: false,
    }),
  });

  const rawText = await res.text().catch(() => "");
  if (!res.ok) {
    throw new Error(`Gosi Brain error ${res.status}: ${rawText.slice(0, 800)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(rawText) as typeof data;
  } catch {
    throw new Error(`Gosi Brain returned non-JSON (first 200 chars): ${rawText.slice(0, 200)}`);
  }

  let content = data.choices?.[0]?.message?.content ?? "";
  content = stripGosiBrainCoT(content);
  return { response: content, model };
}

/** Single-chunk stream compatible with /api/generate stream handler. */
export async function* streamGosiBrain(opts: GosiBrainOptions): AsyncGenerator<string, void, unknown> {
  const { response } = await gosiBrainGenerate(opts);
  if (response) yield response;
}
