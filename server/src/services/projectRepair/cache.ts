import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { ProjectRepairAnalysisResult, RollbackSnapshot } from "./types.js";

const CACHE_DIR = (() => {
  const base =
    process.env.NETLIFY || process.env.READONLY_FS || process.env.LAMBDA_TASK_ROOT
      ? path.join("/tmp", "katalon-data", "project-repair-cache")
      : path.join(process.cwd(), "server", "data", "project-repair-cache");
  return base;
})();

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "");
}

export function repairCachePath(projectId: string): string {
  return path.join(CACHE_DIR, `${safeId(projectId)}.json`);
}

export function rollbackPath(rollbackId: string): string {
  return path.join(CACHE_DIR, "rollback", `${safeId(rollbackId)}.json`);
}

export function repairZipPath(repairId: string): string {
  return path.join(CACHE_DIR, "zips", `${safeId(repairId)}.zip`);
}

export function indexFingerprint(index: ProjectIndex): string {
  return `repair|${index.uploadDate}|${index.stats.testScripts}|${index.stats.testObjects}|${index.stats.keywords}`;
}

export async function loadCachedRepair(
  projectId: string,
  fingerprint: string
): Promise<ProjectRepairAnalysisResult | null> {
  try {
    const raw = await fs.readFile(repairCachePath(projectId), "utf8");
    const data = JSON.parse(raw) as ProjectRepairAnalysisResult & { fingerprint?: string };
    if (data.fingerprint !== fingerprint) return null;
    return { ...data, fromCache: true };
  } catch {
    return null;
  }
}

export async function saveCachedRepair(
  result: ProjectRepairAnalysisResult,
  fingerprint: string
): Promise<void> {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  await fs.writeFile(
    repairCachePath(result.projectId),
    JSON.stringify({ ...result, fingerprint, fromCache: false }),
    "utf8"
  );
}

export async function saveRollbackSnapshot(snapshot: RollbackSnapshot): Promise<void> {
  await fs.mkdir(path.join(CACHE_DIR, "rollback"), { recursive: true });
  await fs.writeFile(rollbackPath(snapshot.rollbackId), JSON.stringify(snapshot), "utf8");
}

export async function loadRollbackSnapshot(
  rollbackId: string
): Promise<RollbackSnapshot | null> {
  try {
    const raw = await fs.readFile(rollbackPath(rollbackId), "utf8");
    return JSON.parse(raw) as RollbackSnapshot;
  } catch {
    return null;
  }
}
