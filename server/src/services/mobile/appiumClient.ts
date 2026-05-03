export interface AppiumStartSessionResult {
  sessionId: string;
  capabilities: Record<string, unknown>;
  endpointBase: string;
}

/** Thrown when the TCP connection to Appium fails (server down, wrong host/port). */
export class AppiumConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppiumConnectionError";
  }
}

function normBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function formatAppiumFetchError(url: string, err: unknown): string {
  const baseHint =
    "Ensure Appium is running (for example `appium` or Appium Desktop), the URL matches your server (default http://127.0.0.1:4723), and no firewall is blocking localhost.";
  const cause =
    err instanceof Error && err.cause && typeof err.cause === "object" && "code" in err.cause
      ? String((err.cause as NodeJS.ErrnoException).code)
      : "";
  if (cause === "ECONNREFUSED") {
    return `Cannot connect to Appium at ${url}. Nothing is listening there (${cause}). ${baseHint}`;
  }
  if (cause === "ENOTFOUND" || cause === "EAI_AGAIN") {
    return `Cannot resolve Appium host for ${url} (${cause}). Check the URL.`;
  }
  if (cause === "ETIMEDOUT") {
    return `Timed out connecting to Appium at ${url}. ${baseHint}`;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return `Request to Appium failed (${url}): ${msg}. ${baseHint}`;
}

async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new AppiumConnectionError(formatAppiumFetchError(url, err));
  }
  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, json, text };
}

function unwrapSessionResponse(json: any): { sessionId?: string; caps?: Record<string, unknown> } {
  // WebDriver classic: { sessionId, value: { capabilities } }
  if (json && typeof json === "object") {
    const sid = typeof json.sessionId === "string" ? json.sessionId : undefined;
    const val = json.value;
    if (val && typeof val === "object") {
      const caps =
        (val.capabilities && typeof val.capabilities === "object" ? val.capabilities : undefined) ??
        (typeof val.platformName === "string" ? (val as Record<string, unknown>) : undefined) ??
        (val as Record<string, unknown>);
      return { sessionId: sid ?? (typeof val.sessionId === "string" ? val.sessionId : undefined), caps };
    }
    if (sid) return { sessionId: sid, caps: undefined };
  }
  return {};
}

export async function startAppiumSession(params: {
  appiumUrl: string;
  capabilities: Record<string, unknown>;
}): Promise<AppiumStartSessionResult> {
  const base = normBase(params.appiumUrl);
  const payload = {
    capabilities: {
      alwaysMatch: params.capabilities,
      firstMatch: [{}],
    },
  };

  // Appium 2: /session, Appium 1 sometimes requires /wd/hub/session
  const candidates = [`${base}/session`, `${base}/wd/hub/session`];

  let lastErr = "";
  for (const endpoint of candidates) {
    const r = await fetchJson(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const v = r.json?.value;
      const msg =
        v && typeof v === "object" && typeof (v as any).message === "string"
          ? String((v as any).message)
          : "";
      lastErr =
        msg ||
        (typeof r.json?.message === "string" ? r.json.message : "") ||
        r.text?.slice(0, 800) ||
        `HTTP ${r.status}`;
      continue;
    }
    const { sessionId, caps } = unwrapSessionResponse(r.json ?? {});
    if (!sessionId) {
      lastErr = `Could not parse sessionId from Appium response: ${r.text.slice(0, 300)}`;
      continue;
    }
    return { sessionId, capabilities: caps ?? {}, endpointBase: endpoint.replace(/\/session$/, "") };
  }

  throw new Error(`Could not start Appium session. Last error: ${lastErr || "unknown"}`);
}

/**
 * GET /status (no session). Use this to confirm Appium is running before start session.
 */
export async function pingAppiumServer(
  appiumUrl: string
): Promise<
  { ok: true; statusPath: string; ready?: boolean; version?: string } | { ok: false; error: string }
> {
  const base = normBase(appiumUrl);
  const paths = ["/status", "/wd/hub/status"];
  let lastHttp = "";
  for (const p of paths) {
    try {
      const r = await fetchJson(`${base}${p}`, { method: "GET" });
      if (r.ok && r.json && typeof r.json === "object") {
        const val = (r.json as any).value;
        const ready =
          val?.ready === true ||
          (r.json as any).status === 0 ||
          (typeof val === "object" && val !== null && "build" in val);
        const version =
          typeof val?.build?.version === "string"
            ? val.build.version
            : typeof (r.json as any).version === "string"
              ? (r.json as any).version
              : undefined;
        return { ok: true, statusPath: p, ready: Boolean(ready), version };
      }
      lastHttp = r.text?.slice(0, 300) || `HTTP ${r.status}`;
    } catch (e) {
      if (e instanceof AppiumConnectionError) {
        return { ok: false, error: e.message };
      }
      throw e;
    }
  }
  return {
    ok: false,
    error: `No OK response from ${base}/status or ${base}/wd/hub/status. Last: ${lastHttp || "unknown"}`,
  };
}

export async function stopAppiumSession(params: {
  appiumUrl: string;
  sessionId: string;
}): Promise<void> {
  const base = normBase(params.appiumUrl);
  const candidates = [
    `${base}/session/${encodeURIComponent(params.sessionId)}`,
    `${base}/wd/hub/session/${encodeURIComponent(params.sessionId)}`,
  ];
  for (const endpoint of candidates) {
    const r = await fetchJson(endpoint, { method: "DELETE" });
    if (r.ok) return;
    // ignore and try next
  }
}

export async function getAppiumPageSource(params: {
  appiumUrl: string;
  sessionId: string;
}): Promise<string> {
  const base = normBase(params.appiumUrl);
  const candidates = [
    `${base}/session/${encodeURIComponent(params.sessionId)}/source`,
    `${base}/wd/hub/session/${encodeURIComponent(params.sessionId)}/source`,
  ];
  let last = "";
  for (const endpoint of candidates) {
    const r = await fetchJson(endpoint, { method: "GET" });
    if (!r.ok) {
      last = r.text || `HTTP ${r.status}`;
      continue;
    }
    const v = r.json?.value;
    if (typeof v === "string" && v.trim()) return v;
    if (typeof r.text === "string" && r.text.trim().startsWith("<")) return r.text;
    last = r.text || "Unexpected page source response";
  }
  throw new Error(`Could not read Appium page source. Last error: ${last || "unknown"}`);
}

export async function getAppiumSession(params: {
  appiumUrl: string;
  sessionId: string;
}): Promise<Record<string, unknown>> {
  const base = normBase(params.appiumUrl);
  const candidates = [
    `${base}/session/${encodeURIComponent(params.sessionId)}`,
    `${base}/wd/hub/session/${encodeURIComponent(params.sessionId)}`,
  ];
  let last = "";
  for (const endpoint of candidates) {
    const r = await fetchJson(endpoint, { method: "GET" });
    if (!r.ok) {
      last = r.text || `HTTP ${r.status}`;
      continue;
    }
    const val = r.json?.value;
    if (val && typeof val === "object") return val as Record<string, unknown>;
    return (r.json ?? {}) as Record<string, unknown>;
  }
  throw new Error(`Could not read Appium session. Last error: ${last || "unknown"}`);
}

