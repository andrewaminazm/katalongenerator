/**
 * Jira REST API v3 — runtime credentials or offline demo when none provided.
 */

import * as fs from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import * as path from "node:path";
import * as tls from "node:tls";

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

/**
 * Site root or single context path (e.g. https://host/jira). Strips browser paths like
 * /secure/Dashboard.jspa so REST calls hit …/rest/api/3/… correctly.
 */
/** Trim + remove zero-width / BOM often pasted from Confluence or email. */
export function sanitizeJiraInput(s: string): string {
  return s
    .replace(/^\uFEFF/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .trim();
}

export function normalizeJiraBaseUrl(baseRaw: string): string {
  const trimmed = sanitizeJiraInput(baseRaw);
  if (!trimmed) {
    throw new JiraApiError("Jira base URL is required", 400);
  }
  let withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  // Jira Cloud hosts must use HTTPS; http:// often 301s and breaks Basic auth without redirects.
  if (/^http:\/\/[^/]*\.atlassian\.net/i.test(withProto)) {
    withProto = withProto.replace(/^http:\/\//i, "https://");
  }
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    throw new JiraApiError("Invalid Jira base URL", 400);
  }
  if (!["http:", "https:"].includes(u.protocol)) {
    throw new JiraApiError("Jira base URL must use http or https", 400);
  }
  const p = (u.pathname || "").replace(/\/$/, "") || "";
  const looksLikeBrowserJunk =
    /\/(secure|browse|plugins|projects?)(\/|$)/i.test(p) || /\.jsp$/i.test(p) || /\/dashboard/i.test(p);
  if (!p || p === "/" || looksLikeBrowserJunk) {
    return u.origin;
  }
  if (/^\/[^/]+$/.test(p)) {
    return `${u.origin}${p}`;
  }
  return u.origin;
}

/** Accepts PROJ-123 or a browse URL containing /browse/PROJ-123. */
export function normalizeJiraIssueKey(raw: string): string {
  const t = raw.trim();
  if (!t) {
    throw new JiraApiError("issueKey is required", 400);
  }
  if (/^[A-Z][A-Z0-9_]{1,9}-\d+$/i.test(t)) {
    return t.toUpperCase();
  }
  const browse = t.match(/\/browse\/([A-Z][A-Z0-9_]{1,9}-\d+)(?:\/|$|\?|#)/i);
  if (browse) {
    return browse[1].toUpperCase();
  }
  if (/\/browse\/[A-Za-z0-9_-]+$/i.test(t) && !/\/browse\/[A-Z][A-Z0-9_]{1,9}-\d+/i.test(t)) {
    throw new JiraApiError(
      "Issue key is incomplete. Use a full key such as DE-123, or paste the complete Jira issue URL.",
      400
    );
  }
  throw new JiraApiError(
    "Could not parse issue key. Use e.g. PROJ-123 or a URL containing …/browse/PROJ-123.",
    400
  );
}

function jiraTlsInsecure(): boolean {
  const v = (process.env.JIRA_TLS_INSECURE ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

let jiraHttpsAgentCache: https.Agent | null = null;

/**
 * Dedicated agent so TLS options apply reliably (top-level `ca` / `rejectUnauthorized` on
 * `https.request` is easy to get wrong). Merges Node public roots + optional PEM files.
 */
function getJiraHttpsAgent(): https.Agent {
  if (jiraHttpsAgentCache) return jiraHttpsAgentCache;
  if (jiraTlsInsecure()) {
    jiraHttpsAgentCache = new https.Agent({ rejectUnauthorized: false });
    return jiraHttpsAgentCache;
  }

  const bundlePath = process.env.JIRA_CA_BUNDLE?.trim();
  const nodeExtraPath = process.env.NODE_EXTRA_CA_CERTS?.trim();
  const extraPems: string[] = [];

  if (bundlePath) {
    const resolved = path.resolve(bundlePath);
    if (!fs.existsSync(resolved)) {
      throw new JiraApiError(`JIRA_CA_BUNDLE file not found: ${resolved}`, 500);
    }
    if (!fs.statSync(resolved).isFile()) {
      throw new JiraApiError(`JIRA_CA_BUNDLE must be a PEM file: ${resolved}`, 500);
    }
    const pem = fs.readFileSync(resolved, "utf8").trim();
    if (!pem) {
      throw new JiraApiError(`JIRA_CA_BUNDLE file is empty: ${resolved}`, 500);
    }
    extraPems.push(pem);
  }

  if (nodeExtraPath) {
    const resolved = path.resolve(nodeExtraPath);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const pem = fs.readFileSync(resolved, "utf8").trim();
      if (pem) extraPems.push(pem);
    }
  }

  if (extraPems.length === 0) {
    jiraHttpsAgentCache = https.globalAgent;
    return jiraHttpsAgentCache;
  }

  const ca = [...tls.rootCertificates, ...extraPems].join("\n");
  jiraHttpsAgentCache = new https.Agent({ ca });
  return jiraHttpsAgentCache;
}

/** Call once after dotenv — confirms env paths (no secrets). */
export function logJiraTlsStartupHint(): void {
  if (jiraTlsInsecure()) {
    console.log("Jira HTTPS: JIRA_TLS_INSECURE is set — verification disabled for Jira requests only.");
    return;
  }
  const b = process.env.JIRA_CA_BUNDLE?.trim();
  const n = process.env.NODE_EXTRA_CA_CERTS?.trim();
  if (b) {
    const r = path.resolve(b);
    console.log(
      `Jira HTTPS: JIRA_CA_BUNDLE → ${fs.existsSync(r) ? "found" : "MISSING"} ${r}`
    );
  }
  if (n) {
    const r = path.resolve(n);
    console.log(
      `Jira HTTPS: NODE_EXTRA_CA_CERTS → ${fs.existsSync(r) ? "found" : "MISSING"} ${r}`
    );
  }
  if (!b && !n) {
    console.log(
      "Jira HTTPS: no JIRA_CA_BUNDLE / NODE_EXTRA_CA_CERTS — using default CA store (set JIRA_TLS_INSECURE=1 to test)."
    );
  }
}

/**
 * GET over HTTPS using {@link getJiraHttpsAgent} so corporate CAs and insecure mode work.
 * Follows same-host redirects (http→https, trailing slash) so Authorization is preserved on the final URL.
 */
function jiraHttpsGet(
  urlStr: string,
  headers: Record<string, string>,
  redirectDepth = 0
): Promise<{ status: number; body: string }> {
  const maxRedirects = 5;
  const u = new URL(urlStr);
  const isHttps = u.protocol === "https:";
  const reqPath = (u.pathname || "/") + (u.search || "");
  const port = u.port ? Number(u.port) : isHttps ? 443 : 80;

  return new Promise((resolve, reject) => {
    const lib = isHttps ? https : http;
    const req = lib.request(
      {
        hostname: u.hostname,
        port,
        path: reqPath,
        method: "GET",
        headers,
        ...(isHttps ? { agent: getJiraHttpsAgent() } : {}),
      },
      (res) => {
        const code = res.statusCode ?? 0;
        const loc = res.headers.location;
        if (
          code >= 300 &&
          code < 400 &&
          typeof loc === "string" &&
          loc.trim() &&
          redirectDepth < maxRedirects
        ) {
          try {
            const nextUrl = new URL(loc, urlStr).href;
            res.resume();
            jiraHttpsGet(nextUrl, headers, redirectDepth + 1).then(resolve).catch(reject);
            return;
          } catch {
            /* fall through */
          }
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: code,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function jiraCommonHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    // Some reverse proxies/WAFs drop requests without User-Agent.
    "User-Agent": "KatalonOllamaTool/1.0 (Node.js)",
  };
}

/**
 * Jira DC/server: REST accepts Basic (username:password or username:PAT).
 * Many PAT setups expect `Authorization: Bearer <PAT>` instead — try both when Basic returns 401/403.
 */
async function jiraGetWithAuth(
  url: string,
  creds: { email: string; apiToken: string }
): Promise<{ status: number; body: string }> {
  const basic = Buffer.from(`${creds.email}:${creds.apiToken}`, "utf8").toString("base64");
  const r1 = await jiraHttpsGet(url, {
    ...jiraCommonHeaders(),
    Authorization: `Basic ${basic}`,
  });
  if (r1.status >= 200 && r1.status < 300) return r1;
  if (r1.status !== 401 && r1.status !== 403) return r1;

  const r2 = await jiraHttpsGet(url, {
    ...jiraCommonHeaders(),
    Authorization: `Bearer ${creds.apiToken}`,
  });
  if (r2.status >= 200 && r2.status < 300) return r2;
  return r2.status !== r1.status ? r2 : r1;
}

function parseJiraErrorBody(status: number, bodyText: string): string {
  const raw = bodyText.trim();
  try {
    const j = JSON.parse(raw) as {
      errorMessages?: string[];
      message?: string;
      reason?: string;
      errors?: Record<string, string>;
    };
    if (Array.isArray(j.errorMessages) && j.errorMessages.length > 0) {
      return j.errorMessages[0];
    }
    if (typeof j.reason === "string" && j.reason.trim()) {
      return j.reason.trim();
    }
    if (typeof j.message === "string" && j.message.trim()) {
      return j.message.trim();
    }
    const vals = j.errors && typeof j.errors === "object" ? Object.values(j.errors) : [];
    const first = vals.find((v) => typeof v === "string");
    if (first) return first as string;
  } catch {
    /* not JSON */
  }
  if (/DOCTYPE\s+html/i.test(raw)) {
    return "Jira returned an HTML page instead of JSON — often a proxy, firewall, or SSO/WAF blocking API access (not a normal REST JSON error).";
  }
  if (raw) return raw.slice(0, 400);
  if (status === 401) return "Authentication failed (empty response from Jira).";
  if (status === 403) return "Forbidden (empty response from Jira).";
  if (status === 404) return "Issue not found";
  return "Jira request failed";
}

const jiraAuthHint =
  " Jira Cloud: Atlassian account email + API token from https://id.atlassian.com/manage-profile/security/api-tokens. Jira Server/Data Center: use your Jira login username (often not an email) with your password or a Personal Access Token (Profile → Personal Access Tokens).";

const jiraCloud401Extra =
  " For *.atlassian.net (Jira Cloud), the login field must be your Atlassian account email (same as id.atlassian.com), not a short username like CR241011 — Cloud rejects username+token Basic auth.";

const jira403Hint =
  " HTTP 403 on Cloud: confirm account + project access and correct *.atlassian.net site. On Data Center/server: REST may be restricted (admin), wrong context path (include /jira if your URL is …/jira/secure/…), or use a Personal Access Token (Bearer) — the server tries Bearer automatically after Basic fails.";

/**
 * Fetch a single issue from Jira Cloud/Server using REST API v3.
 * Does not log credentials or response bodies containing secrets.
 */
export async function getJiraIssue(
  issueKey: string,
  creds: JiraCredentials
): Promise<{ key: string; summary: string; steps: string[] }> {
  const key = normalizeJiraIssueKey(issueKey);

  const baseRaw = sanitizeJiraInput(creds.baseUrl);
  const email = sanitizeJiraInput(creds.email);
  const apiToken = sanitizeJiraInput(creds.apiToken);
  if (!baseRaw) throw new JiraApiError("Jira base URL is required", 400);
  if (!email) throw new JiraApiError("Email or username is required", 400);
  if (!apiToken) throw new JiraApiError("API token is required", 400);

  const base = normalizeJiraBaseUrl(baseRaw);

  let resStatus: number;
  let bodyText: string;
  try {
    const v3Url = `${base}/rest/api/3/issue/${encodeURIComponent(key)}`;
    let r = await jiraGetWithAuth(v3Url, { email, apiToken });
    if (r.status === 404) {
      const v2Url = `${base}/rest/api/2/issue/${encodeURIComponent(key)}`;
      r = await jiraGetWithAuth(v2Url, { email, apiToken });
    }
    resStatus = r.status;
    bodyText = r.body;
  } catch (e) {
    if (e instanceof JiraApiError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    let cause = "";
    if (e instanceof Error && e.cause != null) {
      cause = e.cause instanceof Error ? e.cause.message : String(e.cause);
    }
    const combined = cause && !msg.includes(cause) ? `${msg} (${cause})` : msg;
    let hint = "";
    if (/certificate|CERT|SSL|TLS|UNABLE_TO_VERIFY|self-signed|issuer certificate/i.test(combined)) {
      hint =
        " Use an absolute path in server/.env for JIRA_CA_BUNDLE (PEM with root + intermediates), or JIRA_TLS_INSECURE=1 for dev. NODE_EXTRA_CA_CERTS is also merged when the file exists. Restart the server after changing env.";
    } else if (/fetch failed|ECONNREFUSED|ENOTFOUND|getaddrinfo|ETIMEDOUT/i.test(combined)) {
      hint =
        " Check VPN and network from the server, DNS for the Jira host, and use the site root as base URL (e.g. https://jira.example.com — dashboard paths are stripped automatically).";
    }
    throw new JiraApiError(`Cannot reach Jira: ${combined}.${hint}`, 502);
  }

  if (resStatus < 200 || resStatus >= 300) {
    const msg = parseJiraErrorBody(resStatus, bodyText);
    if (resStatus === 401) {
      const cloudExtra =
        /\.atlassian\.net$/i.test(new URL(base).hostname) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? jiraCloud401Extra
          : "";
      const dcExtra =
        !/\.atlassian\.net$/i.test(new URL(base).hostname)
          ? " Tried HTTP Basic and Bearer (PAT). Use your Jira password or a PAT from Profile → Personal Access Tokens."
          : "";
      throw new JiraApiError(`${msg}${cloudExtra}${dcExtra}${jiraAuthHint}`, 401);
    }
    if (resStatus === 403) {
      console.warn(
        `[jira] ${resStatus} issue=${key} host=${new URL(base).hostname} jiraMessage=${msg.slice(0, 200)}`
      );
      throw new JiraApiError(`${msg}${jira403Hint}`, 403);
    }
    if (resStatus === 404) {
      throw new JiraApiError("Issue not found (checked REST API v3 and v2).", 404);
    }
    const code = resStatus >= 400 && resStatus < 600 ? resStatus : 500;
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

function isProbablyHtmlJiraResponse(body: string): boolean {
  const t = body.trim().slice(0, 800).toLowerCase();
  return (
    t.startsWith("<!") ||
    t.startsWith("<html") ||
    t.includes("<!doctype html") ||
    (t.includes("<head") && t.includes("<body"))
  );
}

/** Parse /myself JSON or explain HTML / garbage (proxy, SSO, wrong context path). */
function parseJiraMyselfJson(body: string, base: string): {
  displayName?: string;
  name?: string;
  emailAddress?: string;
  accountId?: string;
} {
  const raw = body.trim();
  if (!raw) {
    throw new JiraApiError(
      "Jira returned an empty body for /myself. Check the Jira base URL and that the REST API is enabled.",
      502
    );
  }
  if (isProbablyHtmlJiraResponse(raw)) {
    const withJira = base.endsWith("/jira") ? base : `${base}/jira`;
    throw new JiraApiError(
      `Jira /myself returned HTML (not JSON), usually a login/SSO/proxy page or wrong site path. ` +
        `If your browser opens Jira under .../jira/..., set Jira base URL to include /jira (example: ${withJira}).`,
      502
    );
  }
  try {
    return JSON.parse(raw) as {
      displayName?: string;
      name?: string;
      emailAddress?: string;
      accountId?: string;
    };
  } catch {
    const preview = raw.slice(0, 160).replace(/\s+/g, " ");
    throw new JiraApiError(
      `Jira /myself response was not valid JSON (preview): ${preview}`,
      502
    );
  }
}

/**
 * GET /rest/api/3/myself — confirms email+token (or Server username+secret) work before loading an issue.
 * If this succeeds but GET issue returns 403, the problem is project/issue permission, not the token.
 */
export async function getJiraMyself(
  creds: JiraCredentials
): Promise<{ displayName: string; emailAddress?: string; accountId?: string }> {
  const baseRaw = sanitizeJiraInput(creds.baseUrl);
  const email = sanitizeJiraInput(creds.email);
  const apiToken = sanitizeJiraInput(creds.apiToken);
  if (!baseRaw) throw new JiraApiError("Jira base URL is required", 400);
  if (!email) throw new JiraApiError("Email or username is required", 400);
  if (!apiToken) throw new JiraApiError("API token is required", 400);

  const base = normalizeJiraBaseUrl(baseRaw);

  const fetchMyself = async (apiBase: string) => {
    let r = await jiraGetWithAuth(`${apiBase}/rest/api/3/myself`, { email, apiToken });
    if (r.status === 404) {
      r = await jiraGetWithAuth(`${apiBase}/rest/api/2/myself`, { email, apiToken });
    }
    return r;
  };

  const mapMyself = (data: {
    displayName?: string;
    name?: string;
    emailAddress?: string;
    accountId?: string;
  }) => {
    const displayName = (data.displayName ?? data.name ?? "").trim() || "(unknown)";
    return {
      displayName,
      emailAddress: typeof data.emailAddress === "string" ? data.emailAddress : undefined,
      accountId: typeof data.accountId === "string" ? data.accountId : undefined,
    };
  };

  const handleErrorStatus = (status: number, body: string, hostBase: string) => {
    const msg = parseJiraErrorBody(status, body);
    if (status === 401) {
      const cloudExtra =
        /\.atlassian\.net$/i.test(new URL(hostBase).hostname) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? jiraCloud401Extra
          : "";
      const dcExtra =
        !/\.atlassian\.net$/i.test(new URL(hostBase).hostname)
          ? " Tried HTTP Basic and Bearer (PAT). Use your Jira password or a PAT from Profile → Personal Access Tokens."
          : "";
      throw new JiraApiError(`${msg}${cloudExtra}${dcExtra}${jiraAuthHint}`, 401);
    }
    if (status === 403) {
      throw new JiraApiError(`${msg}${jira403Hint}`, 403);
    }
    const code = status >= 400 && status < 600 ? status : 502;
    throw new JiraApiError(msg, code);
  };

  const tryBases: string[] = [base];
  const root = base.replace(/\/+$/, "");
  if (!root.toLowerCase().endsWith("/jira")) {
    tryBases.push(`${root}/jira`);
  }

  let lastParseError: JiraApiError | undefined;
  for (let i = 0; i < tryBases.length; i++) {
    const apiBase = tryBases[i];
    const r = await fetchMyself(apiBase);
    if (r.status < 200 || r.status >= 300) {
      if (r.status === 404 && i < tryBases.length - 1) {
        continue;
      }
      handleErrorStatus(r.status, r.body, apiBase);
    }
    try {
      const data = parseJiraMyselfJson(r.body, apiBase);
      return mapMyself(data);
    } catch (e) {
      if (e instanceof JiraApiError) {
        lastParseError = e;
        if (i < tryBases.length - 1) {
          continue;
        }
      }
      throw e;
    }
  }

  if (lastParseError) throw lastParseError;
  throw new JiraApiError("Could not reach Jira /myself", 502);
}
