import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import type { ProjectIndex, ProjectMeta } from "./types.js";

const __dataDir = (() => {
  try {
    return path.dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

const DATA_ROOT = (() => {
  const base =
    process.env.NETLIFY || process.env.READONLY_FS || process.env.LAMBDA_TASK_ROOT
      ? path.join("/tmp", "katalon-data")
      : path.join(__dataDir, "..", "..", "data");
  return path.join(base, "projects");
})();

export function getProjectsDataRoot(): string {
  return DATA_ROOT;
}

export function newProjectId(): string {
  return crypto.randomUUID();
}

export async function ensureProjectsDir(): Promise<void> {
  await fs.mkdir(DATA_ROOT, { recursive: true });
}

export function projectDir(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(DATA_ROOT, safe);
}

export async function saveProjectIndex(index: ProjectIndex): Promise<void> {
  await ensureProjectsDir();
  const dir = projectDir(index.projectId);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "index.json"), JSON.stringify(index, null, 2), "utf8");
  const meta: ProjectMeta = {
    projectId: index.projectId,
    projectName: index.projectName,
    uploadDate: index.uploadDate,
    sourceType: index.sourceType,
    stats: index.stats,
  };
  await fs.writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2), "utf8");
}

function normalizeLegacyIndex(parsed: ProjectIndex): ProjectIndex {
  const legacy = parsed as ProjectIndex & { testCases?: ProjectIndex["testScripts"] };
  if (!parsed.testScripts?.length && legacy.testCases?.length) {
    parsed.testScripts = legacy.testCases.map((t) =>
      "logicalPath" in t && t.logicalPath
        ? t
        : {
            logicalPath: (t as { path?: string }).path ?? t.scriptPath ?? "",
            scriptPath: t.scriptPath ?? (t as { path?: string }).path ?? "",
            kind: "test_case" as const,
            displayName: (t as { path?: string }).path?.split("/").pop() ?? "",
            findTestObjectRefs: t.findTestObjectRefs ?? [],
            customKeywordRefs: t.customKeywordRefs ?? [],
            stepComments: t.stepComments ?? [],
            webUiCalls: [],
            lineCount: 0,
            semanticSummary: (t as { path?: string }).path ?? "",
          }
    );
  }
  if (parsed.stats) {
    if (parsed.stats.testScripts == null && parsed.stats.testCases != null) {
      parsed.stats.testScripts = parsed.stats.testCases;
    }
  }
  return parsed;
}

export async function loadProjectIndex(projectId: string): Promise<ProjectIndex | null> {
  try {
    const raw = await fs.readFile(path.join(projectDir(projectId), "index.json"), "utf8");
    return normalizeLegacyIndex(JSON.parse(raw) as ProjectIndex);
  } catch {
    return null;
  }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  await ensureProjectsDir();
  const entries = await fs.readdir(DATA_ROOT, { withFileTypes: true });
  const metas: ProjectMeta[] = [];
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_ROOT, ent.name, "meta.json"), "utf8");
      metas.push(JSON.parse(raw) as ProjectMeta);
    } catch {
      /* skip incomplete */
    }
  }
  return metas.sort((a, b) => b.uploadDate.localeCompare(a.uploadDate));
}

export async function deleteProject(projectId: string): Promise<boolean> {
  try {
    await fs.rm(projectDir(projectId), { recursive: true, force: true });
    try {
      const { deleteProjectMemory } = await import("../aiMemory/index.js");
      await deleteProjectMemory(projectId);
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}
