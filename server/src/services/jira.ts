/**
 * Jira REST API v3 — runtime credentials or offline demo when none provided.
 */

export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
}

export interface JiraIssueResult {
  key: string;
  summary: string;
  steps: string[];
  mock: boolean;
}

export class JiraApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "JiraApiError";
  }
}

/** Offline steps when the client omits credentials (never calls Jira). */
export function getMockJiraIssue(issueKey: string): JiraIssueResult {
  const key = (issueKey.trim().toUpperCase() || "DEMO-1").replace(/\s+/g, "");
  return {
    key,
    summary: `[Demo] ${key} — sample test steps (add Jira URL, email, and API token to load a real issue)`,
    steps: [
      "1. Open browser",
      "2. Navigate to application URL",
      "3. Enter username",
      "4. Enter password",
      "5. Click login",
      "6. Verify dashboard is visible",
    ],
    mock: true,
  };
}

/** Recursively extract plain text from Jira Atlassian Document Format (ADF). */
function extractTextFromAdf(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (typeof node !== "object") return "";
  const o = node as Record<string, unknown>;
  if (typeof o.text === "string") return o.text;
  if (o.type === "hardBreak") return "\n";
  if (!Array.isArray(o.content)) return "";

  const ty = typeof o.type === "string" ? o.type : "";
  const parts = (o.content as unknown[]).map((child) => extractTextFromAdf(child));
  let inner = parts.join("");

  if (ty === "paragraph" || ty === "heading") {
    inner = inner.trimEnd() + "\n";
  } else if (ty === "listItem") {
    inner = inner.trimEnd() + "\n";
  } else if (ty === "bulletList" || ty === "orderedList") {
    inner = inner.trimEnd() + "\n";
  }

  return inner;
}

function descriptionToPlainText(description: unknown): string {
  if (description == null) return "";
  if (typeof description === "string") return description.trim();
  try {
    return extractTextFromAdf(description)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return "";
  }
}

/**
 * Parse Jira description into step lines (plain text, bullets, or numbered).
 */
export function extractSteps(description: unknown): string[] {
  const plain = descriptionToPlainText(description);
  if (!plain) return [];

  const lines = plain
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

  const steps: string[] = [];
  const numbered = /^(\d+)[.)]\s*(.+)$/;

  for (const line of lines) {
    const m = line.match(numbered);
    if (m) {
      steps.push(`${m[1]}. ${m[2].trim()}`);
    } else if (line.length > 0) {
      steps.push(line);
    }
  }

  return steps.length ? steps : [plain];
}

function parseJiraErrorBody(status: number, bodyText: string): string {
  if (status === 401 || status === 403) return "Invalid credentials";
  if (status === 404) return "Issue not found";
  try {
    const j = JSON.parse(bodyText) as {
      errorMessages?: string[];
      errors?: Record<string, string>;
    };
    if (Array.isArray(j.errorMessages) && j.errorMessages.length > 0) {
      return j.errorMessages[0];
    }
    const vals = j.errors && typeof j.errors === "object" ? Object.values(j.errors) : [];
    const first = vals.find((v) => typeof v === "string");
    if (first) return first as string;
  } catch {
    /* use fallback */
  }
  return bodyText.trim().slice(0, 200) || "Jira request failed";
}

/**
 * Fetch a single issue from Jira Cloud/Server using REST API v3.
 * Does not log credentials or response bodies containing secrets.
 */
export async function getJiraIssue(
  issueKey: string,
  creds: JiraCredentials
): Promise<{ key: string; summary: string; steps: string[] }> {
  const key = issueKey.trim().toUpperCase();
  if (!key) {
    throw new JiraApiError("issueKey is required", 400);
  }

  const baseRaw = creds.baseUrl.trim();
  if (!baseRaw) throw new JiraApiError("Jira base URL is required", 400);
  if (!creds.email.trim()) throw new JiraApiError("Email is required", 400);
  if (!creds.apiToken.trim()) throw new JiraApiError("API token is required", 400);

  let parsed: URL;
  try {
    parsed = new URL(baseRaw);
  } catch {
    throw new JiraApiError("Invalid Jira base URL", 400);
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new JiraApiError("Jira base URL must use http or https", 400);
  }

  const base = baseRaw.replace(/\/$/, "");
  const url = `${base}/rest/api/3/issue/${encodeURIComponent(key)}`;
  const auth = Buffer.from(`${creds.email.trim()}:${creds.apiToken.trim()}`, "utf8").toString(
    "base64"
  );

  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new JiraApiError(`Cannot reach Jira: ${msg}`, 502);
  }

  const bodyText = await res.text();
  if (!res.ok) {
    const msg = parseJiraErrorBody(res.status, bodyText);
    if (res.status === 401 || res.status === 403) {
      throw new JiraApiError("Invalid credentials", res.status);
    }
    if (res.status === 404) {
      throw new JiraApiError("Issue not found", 404);
    }
    const code = res.status >= 400 && res.status < 600 ? res.status : 500;
    throw new JiraApiError(msg, code);
  }

  let data: {
    key?: string;
    fields?: {
      summary?: string;
      description?: unknown;
    };
  };
  try {
    data = JSON.parse(bodyText) as typeof data;
  } catch {
    throw new JiraApiError("Invalid JSON from Jira", 502);
  }

  const summary = (data.fields?.summary ?? key).trim();
  const fromDesc = extractSteps(data.fields?.description);
  const steps =
    fromDesc.length > 0 ? fromDesc : summary ? [summary] : [`${data.key ?? key} (empty issue)`];

  return {
    key: (data.key ?? key).trim(),
    summary,
    steps,
  };
}
