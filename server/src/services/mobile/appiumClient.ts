export interface AppiumStartSessionResult {
  sessionId: string;
  capabilities: Record<string, unknown>;
  endpointBase: string;
}

function normBase(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

async function fetchJson(
  url: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  const res = await fetch(url, init);
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
      lastErr = r.text || `HTTP ${r.status}`;
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

