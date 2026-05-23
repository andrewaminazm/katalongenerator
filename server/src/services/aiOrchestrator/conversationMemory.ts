import fs from "node:fs/promises";
import path from "node:path";

export interface ConversationPrefs {
  prefersPageObjects: boolean;
  prefersKeywords: boolean;
  prefersSoftAssertions: boolean;
  prefersCustomWaits: boolean;
  recentTopics: string[];
}

const DATA_DIR = (() => {
  const base =
    process.env.NETLIFY || process.env.READONLY_FS || process.env.LAMBDA_TASK_ROOT
      ? path.join("/tmp", "katalon-data", "orchestrator-memory")
      : path.join(process.cwd(), "server", "data", "orchestrator-memory");
  return base;
})();

function sessionPath(projectId?: string): string {
  const key = (projectId ?? "global").replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_DIR, `${key}.json`);
}

const DEFAULT_PREFS: ConversationPrefs = {
  prefersPageObjects: false,
  prefersKeywords: true,
  prefersSoftAssertions: false,
  prefersCustomWaits: false,
  recentTopics: [],
};

export async function loadConversationPrefs(projectId?: string): Promise<ConversationPrefs> {
  try {
    const raw = await fs.readFile(sessionPath(projectId), "utf8");
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export async function saveConversationPrefs(
  projectId: string | undefined,
  prefs: Partial<ConversationPrefs>
): Promise<void> {
  const current = await loadConversationPrefs(projectId);
  const next: ConversationPrefs = {
    ...current,
    ...prefs,
    recentTopics: [
      ...(prefs.recentTopics ?? current.recentTopics),
    ].slice(-20),
  };
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(sessionPath(projectId), JSON.stringify(next, null, 2), "utf8");
}

export function inferPrefsFromPrompt(prompt: string): Partial<ConversationPrefs> {
  const lower = prompt.toLowerCase();
  return {
    ...( /\bpage\s*object\b/.test(lower) ? { prefersPageObjects: true } : {}),
    ...( /\b(keyword|customkeywords)\b/.test(lower) ? { prefersKeywords: true } : {}),
    ...( /\bsoft\s+assert/.test(lower) ? { prefersSoftAssertions: true } : {}),
    ...( /\bwait\s*helper\b/.test(lower) ? { prefersCustomWaits: true } : {}),
    recentTopics: [prompt.slice(0, 120)],
  };
}
