/**
 * Gosi Brain (IWAI proxy) — OpenAI-compatible chat completions with extra gateway headers.
 */

export interface GosiBrainMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GosiBrainOptions {
  /** Legacy single-string prompt — wrapped as a user message. */
  prompt?: string;
  /** Preferred: full message array with system + history + user. */
  messages?: GosiBrainMessage[];
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

/**
 * Extract the clean JWT from a token string that may contain trailing OAuth
 * response JSON (e.g. `eyJ...abc","token_type":"Bearer",...`). A JWT signature
 * segment matches `[A-Za-z0-9\-_]+` and contains no quotes or commas.
 */
function extractBearerJwt(raw: string): string {
  // Strip "Bearer " prefix to work on the raw credential
  const credential = raw.replace(/^Bearer\s+/i, "").trim();
  // A JWT is exactly three base64url segments separated by dots.
  // Anything after the third segment (non-base64url char) is junk.
  const jwtMatch = credential.match(/^([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)/);
  return jwtMatch ? jwtMatch[1] : credential;
}

function normalizeAuthorizationHeader(token: string): string {
  const jwt = extractBearerJwt(token.trim());
  return `Bearer ${jwt}`;
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

  // Build message array — prefer explicit messages[], fall back to prompt string
  const messages: GosiBrainMessage[] =
    opts.messages && opts.messages.length > 0
      ? opts.messages
      : [{ role: "user", content: opts.prompt ?? "" }];

  // Debug: log masked token prefix and body size to help diagnose WAF rejections
  const jwtPreview = authHeader.replace(/^Bearer\s+/i, "").slice(0, 20);
  const bodyPayload = JSON.stringify({
    model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 16000,
    stream: false,
  });
  console.log(
    `[GosiBrain] → ${url} | model=${model} | tokenPrefix=${jwtPreview}… | bodyBytes=${bodyPayload.length}`
  );

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
      "User-Agent": "KatalonAI/1.0",
    },
    body: bodyPayload,
  });

  const rawText = await res.text().catch(() => "");
  console.log(`[GosiBrain] ← HTTP ${res.status} | bodyBytes=${rawText.length}`);

  if (!res.ok) {
    // Detect WAF HTML rejection (F5 ASM returns 200 or 4xx with HTML body)
    if (rawText.includes("Request Rejected") || rawText.includes("<title>")) {
      throw new Error(
        `Gosi Brain WAF rejected the request (HTTP ${res.status}). ` +
        `Support ID: ${rawText.match(/support ID[^:]*:\s*([\d]+)/i)?.[1] ?? "unknown"}. ` +
        `The bearer token or API key may need to be refreshed.`
      );
    }
    throw new Error(`Gosi Brain error ${res.status}: ${rawText.slice(0, 800)}`);
  }

  let data: { choices?: Array<{ message?: { content?: string } }> };
  try {
    data = JSON.parse(rawText) as typeof data;
  } catch {
    // Detect WAF HTML rejection disguised as 200 OK
    if (rawText.includes("Request Rejected") || rawText.includes("<title>")) {
      throw new Error(
        `Gosi Brain WAF rejected the request (HTTP 200 soft-block). ` +
        `Support ID: ${rawText.match(/support ID[^:]*:\s*([\d]+)/i)?.[1] ?? "unknown"}. ` +
        `The bearer token scope or API key may be invalid for this endpoint. ` +
        `Ask your admin to refresh the token or API key.`
      );
    }
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
