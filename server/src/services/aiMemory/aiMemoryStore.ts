import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProjectMemoryProfile } from "./types.js";

const __dirname = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

const MEMORY_ROOT =
  process.env.NETLIFY || process.env.READONLY_FS || process.env.LAMBDA_TASK_ROOT
    ? path.join("/tmp", "katalon-data", "ai-memory")
    : path.join(__dirname, "..", "..", "data", "ai-memory");

export function memoryFilePath(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(MEMORY_ROOT, `${safe}.json`);
}

export async function saveProjectMemory(profile: ProjectMemoryProfile): Promise<void> {
  await fs.mkdir(MEMORY_ROOT, { recursive: true });
  await fs.writeFile(memoryFilePath(profile.projectId), JSON.stringify(profile, null, 2), "utf8");
}

export async function loadProjectMemory(projectId: string): Promise<ProjectMemoryProfile | null> {
  try {
    const raw = await fs.readFile(memoryFilePath(projectId), "utf8");
    return JSON.parse(raw) as ProjectMemoryProfile;
  } catch {
    return null;
  }
}

export async function deleteProjectMemory(projectId: string): Promise<void> {
  try {
    await fs.unlink(memoryFilePath(projectId));
  } catch {
    /* ignore */
  }
}

export async function listProjectMemories(): Promise<{ projectId: string; builtAt: string }[]> {
  try {
    const files = await fs.readdir(MEMORY_ROOT);
    const out: { projectId: string; builtAt: string }[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const raw = await fs.readFile(path.join(MEMORY_ROOT, f), "utf8");
        const p = JSON.parse(raw) as ProjectMemoryProfile;
        out.push({ projectId: p.projectId, builtAt: p.builtAt });
      } catch {
        /* skip */
      }
    }
    return out;
  } catch {
    return [];
  }
}
