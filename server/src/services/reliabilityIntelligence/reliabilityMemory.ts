import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FailureType } from "../failureAnalysis/types.js";
import type { HistoricalFailureRef } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELIABILITY_DIR = path.resolve(__dirname, "../../../data/reliability-memory");

export interface ReliabilityMemoryEntry {
  id: string;
  projectId?: string;
  signature: string;
  failureType: FailureType;
  rootCauseSummary: string;
  flakyProbability: number;
  repairSucceeded?: boolean;
  orPath?: string;
  module?: string;
  analyzedAt: string;
}

async function ensureDir(): Promise<void> {
  await mkdir(RELIABILITY_DIR, { recursive: true });
}

export async function recordReliabilityMemory(entry: ReliabilityMemoryEntry): Promise<void> {
  await ensureDir();
  const safe = entry.id.replace(/[^a-zA-Z0-9_-]/g, "");
  await writeFile(path.join(RELIABILITY_DIR, `${safe}.json`), JSON.stringify(entry), "utf8");
}

export async function listReliabilityMemory(
  projectId?: string,
  limit = 100
): Promise<ReliabilityMemoryEntry[]> {
  await ensureDir();
  const files = (await readdir(RELIABILITY_DIR)).filter((f) => f.endsWith(".json"));
  const entries: ReliabilityMemoryEntry[] = [];
  for (const file of files) {
    try {
      const raw = await readFile(path.join(RELIABILITY_DIR, file), "utf8");
      const e = JSON.parse(raw) as ReliabilityMemoryEntry;
      if (projectId && e.projectId !== projectId) continue;
      entries.push(e);
    } catch {
      /* skip */
    }
  }
  return entries.sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt)).slice(0, limit);
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3)
  );
}

function similarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

export async function findSimilarHistoricalFailures(
  rootCauseSummary: string,
  failureType: FailureType,
  projectId?: string,
  limit = 5
): Promise<HistoricalFailureRef[]> {
  const entries = await listReliabilityMemory(projectId, 150);
  return entries
    .map((e) => ({
      id: e.id,
      analyzedAt: e.analyzedAt,
      rootCauseSummary: e.rootCauseSummary,
      failureType: e.failureType,
      similarity:
        e.failureType === failureType
          ? similarity(rootCauseSummary, e.rootCauseSummary) + 0.15
          : similarity(rootCauseSummary, e.rootCauseSummary),
    }))
    .filter((e) => e.similarity > 0.2)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map((e) => ({
      id: e.id,
      analyzedAt: e.analyzedAt,
      rootCauseSummary: e.rootCauseSummary,
      failureType: e.failureType,
      similarity: Math.round(e.similarity * 100) / 100,
    }));
}
