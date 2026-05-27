import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { CoverageAnalysisResult } from "./types.js";

const CACHE_DIR = (() => {
  const base =
    process.env.NETLIFY || process.env.READONLY_FS || process.env.LAMBDA_TASK_ROOT
      ? path.join("/tmp", "katalon-data", "coverage-cache")
      : path.join(process.cwd(), "server", "data", "coverage-cache");
  return base;
})();

function cachePath(projectId: string): string {
  const safe = projectId.replace(/[^a-zA-Z0-9_-]/g, "");
  return path.join(CACHE_DIR, `${safe}.json`);
}

export function indexFingerprint(index: ProjectIndex): string {
  return `${index.uploadDate}|${index.stats.testScripts}|${index.stats.testObjects}|${index.stats.keywords}`;
}

export async function loadCachedCoverage(
  projectId: string,
  fingerprint: string
): Promise<CoverageAnalysisResult | null> {
  try {
    const raw = await fs.readFile(cachePath(projectId), "utf8");
    const data = JSON.parse(raw) as CoverageAnalysisResult & { fingerprint?: string };
    if (data.fingerprint !== fingerprint) return null;
    return { ...data, fromCache: true };
  } catch {
    return null;
  }
}

export async function saveCachedCoverage(
  result: CoverageAnalysisResult,
  fingerprint: string
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    cachePath(result.projectId),
    JSON.stringify({ ...result, fingerprint, fromCache: false }),
    "utf8"
  );
}
