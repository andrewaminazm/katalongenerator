import fs from "node:fs/promises";
import path from "node:path";
import type { WorkspaceContextPayload, WorkspaceSession } from "./types.js";

const DATA_DIR = (() => {
  const base =
    process.env.NETLIFY || process.env.READONLY_FS || process.env.LAMBDA_TASK_ROOT
      ? path.join("/tmp", "katalon-data", "ai-workspace")
      : path.join(process.cwd(), "server", "data", "ai-workspace");
  return base;
})();

function sessionFile(id: string): string {
  const safe = id.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${safe}.json`);
}

function newId(): string {
  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function loadSession(sessionId: string): Promise<WorkspaceSession | null> {
  try {
    const raw = await fs.readFile(sessionFile(sessionId), "utf8");
    return JSON.parse(raw) as WorkspaceSession;
  } catch {
    return null;
  }
}

export async function saveSession(session: WorkspaceSession): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(sessionFile(session.id), JSON.stringify(session, null, 2), "utf8");
}

export async function getOrCreateSession(
  sessionId: string | undefined,
  context: WorkspaceContextPayload
): Promise<WorkspaceSession> {
  if (sessionId) {
    const existing = await loadSession(sessionId);
    if (existing) {
      existing.context = { ...existing.context, ...context };
      return existing;
    }
  }
  const now = new Date().toISOString();
  return {
    id: sessionId && sessionId.trim() ? sessionId.replace(/[^a-zA-Z0-9_-]/g, "") : newId(),
    createdAt: now,
    updatedAt: now,
    context,
    messages: [],
  };
}

export async function listRecentSessions(limit = 20): Promise<Array<{ id: string; updatedAt: string }>> {
  try {
    const files = await fs.readdir(DATA_DIR);
    const sessions: Array<{ id: string; updatedAt: string }> = [];
    for (const f of files.slice(0, limit * 2)) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(DATA_DIR, f), "utf8");
        const s = JSON.parse(raw) as WorkspaceSession;
        sessions.push({ id: s.id, updatedAt: s.updatedAt });
      } catch {
        /* skip */
      }
    }
    return sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  } catch {
    return [];
  }
}
