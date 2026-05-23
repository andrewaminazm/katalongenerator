export interface ApiAnalysis {
  detected: boolean;
  problem: string;
  recommendation: string;
  statusCode?: number;
  authIssue: boolean;
  timeout: boolean;
  schemaMismatch: boolean;
  score: number;
}

export function analyzeApiFailure(corpus: string): ApiAnalysis {
  const c = corpus.toLowerCase();
  const statusMatch = corpus.match(/\b(?:HTTP\s*)?([45]\d{2})\b/i);
  const statusCode = statusMatch ? Number(statusMatch[1]) : undefined;

  const detected =
    Boolean(statusCode) ||
    /api\s*error|rest\s*error|ws\.|request\s*failed|invalid\s*response|json.*parse|contract/i.test(c);

  if (!detected) {
    return {
      detected: false,
      problem: "",
      recommendation: "",
      authIssue: false,
      timeout: false,
      schemaMismatch: false,
      score: 0,
    };
  }

  const authIssue = statusCode === 401 || statusCode === 403 || /unauthorized|forbidden|auth/i.test(c);
  const timeout = /timeout|timed out|ETIMEDOUT/i.test(c);
  const schemaMismatch = /schema|contract|unexpected field|json/i.test(c);

  let problem = "An API call failed during test execution.";
  if (authIssue) problem = "API authentication or authorization failed (401/403 or invalid token).";
  else if (statusCode && statusCode >= 500) problem = `Backend returned server error HTTP ${statusCode}.`;
  else if (timeout) problem = "API request timed out before a response was received.";
  else if (schemaMismatch) problem = "API response did not match the expected contract or schema.";

  const recommendation = authIssue
    ? "Refresh test credentials/tokens in profiles; verify auth headers in WS.sendRequest or API keywords."
    : statusCode && statusCode >= 500
      ? "Treat as environment/backend issue; add health check step and retry policy for transient 5xx."
      : "Validate request payload, endpoint URL, and assert on status code + critical response fields.";

  return {
    detected: true,
    problem,
    recommendation,
    statusCode,
    authIssue,
    timeout,
    schemaMismatch,
    score: authIssue ? 0.9 : statusCode && statusCode >= 500 ? 0.85 : 0.7,
  };
}
