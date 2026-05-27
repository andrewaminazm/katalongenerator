import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import { projectDir } from "../projectIntelligence/projectStore.js";
import { classifyTestScriptPath } from "../projectIntelligence/paths.js";

export interface LoadedScript {
  scriptPath: string;
  logicalPath: string;
  content: string;
}

export async function resolveProjectRoot(projectId: string, index: ProjectIndex): Promise<string | null> {
  const dir = projectDir(projectId);
  const sourceDir = path.join(dir, "source");
  try {
    await fs.access(sourceDir);
    return sourceDir;
  } catch {
    if (index.sourceType === "folder") return null;
    return null;
  }
}

export async function loadScriptContents(
  projectId: string,
  index: ProjectIndex,
  maxScripts = 200
): Promise<LoadedScript[]> {
  const root = await resolveProjectRoot(projectId, index);
  if (!root) return [];

  const scripts = (index.testScripts ?? index.testCases ?? []).slice(0, maxScripts);
  const out: LoadedScript[] = [];

  for (const meta of scripts) {
    if (!classifyTestScriptPath(meta.scriptPath)) continue;
    const abs = path.join(root, meta.scriptPath.replace(/\//g, path.sep));
    try {
      const content = await fs.readFile(abs, "utf8");
      out.push({
        scriptPath: meta.scriptPath,
        logicalPath: meta.logicalPath,
        content,
      });
    } catch {
      /* missing on disk */
    }
  }
  return out;
}

export async function loadOrFileContent(
  projectId: string,
  sourceFile: string
): Promise<string | null> {
  const root = path.join(projectDir(projectId), "source");
  const abs = path.join(root, sourceFile.replace(/\//g, path.sep));
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    return null;
  }
}
