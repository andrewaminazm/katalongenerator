export function assertProjectAccess(projectId: string, contextProjectId?: string): void {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (safe !== projectId) {
    throw new Error("Invalid projectId");
  }
  if (contextProjectId && contextProjectId !== projectId) {
    throw new Error("Project memory isolation violation");
  }
}

export function redactSecrets(text: string): string {
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/password\s*[:=]\s*['"][^'"]+['"]/gi, "password=[REDACTED]")
    .replace(/api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi, "api_key=[REDACTED]");
}
