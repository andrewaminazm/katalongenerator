import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FailureAnalysisResult, FailureHistoryEntry, FailurePatternSummary } from "./types.js";
import type { FailureType } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEMORY_DIR = path.resolve(__dirname, "../../../data/failure-memory");

function signatureFor(result: Pick<FailureAnalysisResult, "failureType" | "rootCauseSummary">): string {
  const norm = `${result.failureType}:${result.rootCauseSummary}`.toLowerCase().replace(/\s+/g, " ").slice(0, 120);
  return norm;
}

async function ensureDir(): Promise<void> {
  await mkdir(MEMORY_DIR, { recursive: true });
}

export async function recordFailureAnalysis(
  result: FailureAnalysisResult,
  projectId?: string
): Promise<FailureHistoryEntry> {
  await ensureDir();
  const id = `fa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const signature = signatureFor(result);
  const entry: FailureHistoryEntry = {
    id,
    analyzedAt: result.analyzedAt,
    failureType: result.failureType,
    rootCauseSummary: result.rootCauseSummary.slice(0, 200),
    confidence: result.confidence,
    flakyProbability: result.flakyProbability,
    signature,
    projectId,
  };

  await writeFile(path.join(MEMORY_DIR, `${id}.json`), JSON.stringify({ entry, result }, null, 2), "utf8");
  return entry;
}

export async function listFailureHistory(limit = 50): Promise<FailureHistoryEntry[]> {
  await ensureDir();
  const files = (await readdir(MEMORY_DIR)).filter((f) => f.endsWith(".json"));
  const entries: FailureHistoryEntry[] = [];
  for (const file of files.slice(-limit)) {
    try {
      const raw = await readFile(path.join(MEMORY_DIR, file), "utf8");
      const parsed = JSON.parse(raw) as { entry: FailureHistoryEntry };
      entries.push(parsed.entry);
    } catch {
      /* skip corrupt */
    }
  }
  return entries.sort((a, b) => b.analyzedAt.localeCompare(a.analyzedAt));
}

export async function getFailurePatterns(): Promise<FailurePatternSummary[]> {
  const history = await listFailureHistory(200);
  const map = new Map<
    string,
    { failureType: FailureType; count: number; flakySum: number; lastSeen: string }
  >();

  for (const h of history) {
    const cur = map.get(h.signature) ?? {
      failureType: h.failureType,
      count: 0,
      flakySum: 0,
      lastSeen: h.analyzedAt,
    };
    cur.count += 1;
    cur.flakySum += h.flakyProbability;
    if (h.analyzedAt > cur.lastSeen) cur.lastSeen = h.analyzedAt;
    map.set(h.signature, cur);
  }

  return [...map.entries()]
    .map(([signature, v]) => ({
      signature,
      failureType: v.failureType,
      count: v.count,
      avgFlakyProbability: Math.round((v.flakySum / v.count) * 100) / 100,
      lastSeen: v.lastSeen,
      hotspot: v.count >= 3,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);
}

export async function findRelatedPatterns(
  signature: string,
  failureType: FailureType
): Promise<FailurePatternSummary[]> {
  const patterns = await getFailurePatterns();
  return patterns.filter(
    (p) => p.signature === signature || (p.failureType === failureType && p.hotspot)
  );
}
