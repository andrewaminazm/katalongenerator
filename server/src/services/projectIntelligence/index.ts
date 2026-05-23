export * from "./types.js";
export * from "./projectStore.js";
export * from "./projectScanner.js";
export * from "./generationPlanner.js";
export * from "./projectContextBuilder.js";
export * from "./semanticMatcher.js";
export { parseObjectRepositoryRs } from "./objectRepositoryParser.js";
export { parseKeywordGroovyFile, formatKeywordCall } from "./keywordParser.js";

import fs from "node:fs/promises";
import path from "node:path";
import {
  detectArchiveKind,
  extractArchiveToDir,
  scanProjectDirectory,
} from "./projectScanner.js";
import {
  deleteProject,
  listProjects,
  loadProjectIndex,
  newProjectId,
  projectDir,
  saveProjectIndex,
} from "./projectStore.js";

export async function ingestProjectArchive(
  buffer: Buffer,
  originalFilename: string,
  projectName?: string
): Promise<import("./types.js").ProjectIndex> {
  const kind = detectArchiveKind(originalFilename);
  if (!kind) {
    throw new Error("archive must be a .zip or .rar file");
  }
  const projectId = newProjectId();
  const dir = projectDir(projectId);
  const sourceDir = path.join(dir, "source");
  await extractArchiveToDir(buffer, sourceDir, kind);
  const index = await scanProjectDirectory({
    projectId,
    projectName: projectName?.trim() || `Project ${projectId.slice(0, 8)}`,
    sourceType: kind,
    rootDir: sourceDir,
  });
  await saveProjectIndex(index);
  try {
    const { buildAndSaveProjectMemory } = await import("../aiMemory/index.js");
    await buildAndSaveProjectMemory(index);
  } catch (e) {
    console.warn("[projectIntelligence] AI memory build skipped:", e);
  }
  return index;
}

/** @deprecated Use ingestProjectArchive */
export async function ingestProjectZip(
  buffer: Buffer,
  projectName?: string
): Promise<import("./types.js").ProjectIndex> {
  return ingestProjectArchive(buffer, "upload.zip", projectName);
}

export async function ingestProjectFolder(
  folderPath: string,
  projectName?: string
): Promise<import("./types.js").ProjectIndex> {
  const resolved = path.resolve(folderPath);
  const st = await fs.stat(resolved);
  if (!st.isDirectory()) {
    throw new Error("Path must be an existing directory");
  }
  const projectId = newProjectId();
  const index = await scanProjectDirectory({
    projectId,
    projectName: projectName?.trim() || path.basename(resolved),
    sourceType: "folder",
    rootDir: resolved,
  });
  await saveProjectIndex(index);
  try {
    const { buildAndSaveProjectMemory } = await import("../aiMemory/index.js");
    await buildAndSaveProjectMemory(index);
  } catch (e) {
    console.warn("[projectIntelligence] AI memory build skipped:", e);
  }
  return index;
}

export async function reindexProject(projectId: string): Promise<import("./types.js").ProjectIndex | null> {
  const existing = await loadProjectIndex(projectId);
  if (!existing) return null;
  const dir = projectDir(projectId);
  const sourceDir = path.join(dir, "source");
  let rootDir = sourceDir;
  try {
    await fs.access(sourceDir);
  } catch {
    if (existing.sourceType === "folder") {
      throw new Error("Folder-based project cannot be reindexed without source copy");
    }
    return existing;
  }
  const index = await scanProjectDirectory({
    projectId,
    projectName: existing.projectName,
    sourceType: existing.sourceType,
    rootDir,
  });
  await saveProjectIndex(index);
  try {
    const { buildAndSaveProjectMemory } = await import("../aiMemory/index.js");
    await buildAndSaveProjectMemory(index);
  } catch (e) {
    console.warn("[projectIntelligence] AI memory reindex memory skipped:", e);
  }
  return index;
}

export { listProjects, loadProjectIndex, deleteProject };
