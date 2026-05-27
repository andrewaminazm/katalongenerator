import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectGeneratorResult } from "./types.js";

const CACHE_DIR = (() => {
  const base =
    process.env.NETLIFY || process.env.READONLY_FS || process.env.LAMBDA_TASK_ROOT
      ? path.join("/tmp", "katalon-data", "project-generator")
      : path.join(process.cwd(), "server", "data", "project-generator");
  return base;
})();

export function generationCachePath(generationId: string): string {
  return path.join(CACHE_DIR, `${generationId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
}

export function generationZipPath(generationId: string): string {
  return path.join(CACHE_DIR, "zips", `${generationId.replace(/[^a-zA-Z0-9_-]/g, "")}.zip`);
}

export function inputFingerprint(input: unknown): string {
  return JSON.stringify(input);
}

export async function loadCachedGeneration(
  generationId: string,
  fingerprint: string
): Promise<ProjectGeneratorResult | null> {
  try {
    const raw = await fs.readFile(generationCachePath(generationId), "utf8");
    const data = JSON.parse(raw) as ProjectGeneratorResult & { fingerprint?: string };
    if (data.fingerprint !== fingerprint) return null;
    return { ...data, fromCache: true };
  } catch {
    return null;
  }
}

export async function saveCachedGeneration(
  result: ProjectGeneratorResult,
  fingerprint: string
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const { files, ...meta } = result;
  await fs.writeFile(
    generationCachePath(result.generationId),
    JSON.stringify({ ...meta, fingerprint, fromCache: false, fileCount: files.length }),
    "utf8"
  );
  await fs.writeFile(
    path.join(CACHE_DIR, `${result.generationId}-files.json`),
    JSON.stringify({ generationId: result.generationId, files }),
    "utf8"
  );
}

export async function loadGenerationFiles(
  generationId: string
): Promise<ProjectGeneratorResult["files"] | null> {
  try {
    const raw = await fs.readFile(
      path.join(CACHE_DIR, `${generationId.replace(/[^a-zA-Z0-9_-]/g, "")}-files.json`),
      "utf8"
    );
    const data = JSON.parse(raw) as { files: ProjectGeneratorResult["files"] };
    return data.files;
  } catch {
    return null;
  }
}

export async function loadCachedGenerationMeta(
  generationId: string
): Promise<(Omit<ProjectGeneratorResult, "files"> & { fileCount?: number }) | null> {
  try {
    const raw = await fs.readFile(generationCachePath(generationId), "utf8");
    return JSON.parse(raw) as Omit<ProjectGeneratorResult, "files"> & { fileCount?: number };
  } catch {
    return null;
  }
}

export { CACHE_DIR };
