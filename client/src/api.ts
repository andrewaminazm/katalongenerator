const API_BASE = "";

export type Platform = "web" | "mobile";

export interface LocatorResult {
  name: string;
  selector: string;
  type: "button" | "input" | "link" | "text" | "unknown";
  text?: string;
}

export type GenerateMode = "manual" | "record";

export interface RecorderLocator {
  name: string;
  selector: string;
}

export interface RecordFlowResponse {
  steps: string[];
  locators: RecorderLocator[];
  playwrightScript: string;
}

export interface GeneratePayload {
  platform: Platform;
  steps: string[];
  locators?: string;
  model?: string;
  stream?: boolean;
  testCaseName?: string;
  mode?: GenerateMode;
  recordedPlaywrightScript?: string;
  autoDetectLocators?: boolean;
  url?: string;
}

export interface GenerateResponse {
  code: string;
  model: string;
  platform: Platform;
}

export async function generateCode(
  payload: GeneratePayload
): Promise<GenerateResponse> {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: false }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<GenerateResponse>;
}

export async function generateCodeStream(
  payload: GeneratePayload,
  onChunk: (chunk: string) => void
): Promise<string> {
  const res = await fetch(`${API_BASE}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: true }),
  });
  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    full += chunk;
    onChunk(chunk);
  }
  return full;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Clears a stuck server recording (closed browser tab, refreshed UI, etc.). */
export async function cancelRecordingOnServer(): Promise<void> {
  await fetch(`${API_BASE}/api/record/cancel`, { method: "POST" });
}

/**
 * Starts a headful recording on the server, polls live URL into `onUrlChange`, then returns the script/steps/locators when the session ends (Finish button or timeout).
 */
export async function recordTestFlow(
  url: string,
  onUrlChange?: (url: string) => void
): Promise<RecordFlowResponse> {
  const startOpts = {
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  };
  let start = await fetch(`${API_BASE}/api/record/start`, startOpts);
  if (start.status === 409) {
    await cancelRecordingOnServer();
    start = await fetch(`${API_BASE}/api/record/start`, startOpts);
  }
  if (!start.ok) {
    const err = await start.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || start.statusText);
  }
  for (;;) {
    await sleep(400);
    const stRes = await fetch(`${API_BASE}/api/record/status`);
    if (!stRes.ok) {
      const err = await stRes.json().catch(() => ({}));
      throw new Error((err as { error?: string }).error || stRes.statusText);
    }
    const st = (await stRes.json()) as { active: boolean; url: string | null };
    if (st.url) onUrlChange?.(st.url);
    if (!st.active) break;
  }
  const res = await fetch(`${API_BASE}/api/record/result`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<RecordFlowResponse>;
}

export async function extractLocatorsFromUrl(url: string): Promise<LocatorResult[]> {
  const res = await fetch(`${API_BASE}/api/locators`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  const data = (await res.json()) as { locators: LocatorResult[] };
  return data.locators;
}

export async function parseCsv(file: File): Promise<{ steps: string[] }> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/parse-csv`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json() as Promise<{ steps: string[] }>;
}

export interface JiraCredentialsPayload {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraIssueResponse {
  key: string;
  summary: string;
  steps: string[];
  mock: boolean;
}

/**
 * Fetches Jira issue steps. Pass all three credential fields for a live API call;
 * omit or leave empty for offline demo data (response has mock: true).
 */
export async function fetchJiraIssue(
  issueKey: string,
  credentials?: JiraCredentialsPayload | null
): Promise<JiraIssueResponse> {
  const body: {
    issueKey: string;
    credentials?: JiraCredentialsPayload;
  } = { issueKey };
  const b = credentials?.baseUrl?.trim() ?? "";
  const e = credentials?.email?.trim() ?? "";
  const t = credentials?.apiToken?.trim() ?? "";
  if (b && e && t) {
    body.credentials = { baseUrl: b, email: e, apiToken: t };
  }

  const res = await fetch(`${API_BASE}/api/jira/issue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const errJson = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    let msg = errJson.error || res.statusText;
    if (res.status === 401) msg = errJson.error || "Invalid credentials";
    if (res.status === 404) msg = errJson.error || "Issue not found";
    throw new Error(msg);
  }
  return res.json() as Promise<JiraIssueResponse>;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  platform: Platform;
  model: string;
  testCaseName?: string;
  stepsPreview: string;
  code: string;
}

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const res = await fetch(`${API_BASE}/api/history`);
  if (!res.ok) throw new Error("Failed to load history");
  const data = await res.json();
  return (data as { entries: HistoryEntry[] }).entries;
}

export async function clearHistory(): Promise<void> {
  const res = await fetch(`${API_BASE}/api/history`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to clear history");
}

export async function healthCheck(): Promise<{
  ok: boolean;
  ollamaBase: string;
  defaultModel: string;
}> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Server unreachable");
  return res.json();
}
