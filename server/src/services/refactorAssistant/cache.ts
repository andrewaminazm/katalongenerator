import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { RefactorAnalysisResult } from "./types.js";

const CACHE_DIR = (() => {
  const base =
    process.env.NETLIFY || process.env.READONLY_FS || process.env.LAMBDA_TASK_ROOT
      ? path.join("/tmp", "katalon-data", "refactor-cache")
      : path.join(process.cwd(), "server", "data", "refactor-cache");
  return base;
})();

function cachePath(projectId: string): string {
  return path.join(CACHE_DIR, `${projectId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
}

export function indexFingerprint(index: ProjectIndex): string {
  return `refactor|${index.uploadDate}|${index.stats.testScripts}|${index.stats.testObjects}|${index.stats.keywords}`;
}

export async function loadCachedRefactor(
  projectId: string,
  fingerprint: string
): Promise<RefactorAnalysisResult | null> {
  try {
    const raw = await fs.readFile(cachePath(projectId), "utf8");
    const data = JSON.parse(raw) as RefactorAnalysisResult & { fingerprint?: string };
    if (data.fingerprint !== fingerprint) return null;
    return { ...data, fromCache: true };
  } catch {
    return null;
  }
}

export async function saveCachedRefactor(
  result: RefactorAnalysisResult,
  fingerprint: string
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    cachePath(result.projectId),
    JSON.stringify({ ...result, fingerprint, fromCache: false }),
    "utf8"
  );
}
