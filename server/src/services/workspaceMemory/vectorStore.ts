import fs from "node:fs/promises";
import path from "node:path";
import type { MemoryChunk, MemoryIndex } from "./types.js";

const DATA_DIR = (() => {
  const base =
    process.env.NETLIFY || process.env.READONLY_FS || process.env.LAMBDA_TASK_ROOT
      ? path.join("/tmp", "katalon-data", "workspace-memory")
      : path.join(process.cwd(), "server", "data", "workspace-memory");
  return base;
})();

const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "in",
  "on",
  "for",
  "how",
  "what",
  "show",
  "this",
  "that",
  "with",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_.'/]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

export function termVector(text: string): Record<string, number> {
  const terms: Record<string, number> = {};
  for (const t of tokenize(text)) {
    terms[t] = (terms[t] ?? 0) + 1;
  }
  const max = Math.max(1, ...Object.values(terms));
  for (const k of Object.keys(terms)) {
    terms[k]! /= max;
  }
  return terms;
}

export function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const va = a[k] ?? 0;
    const vb = b[k] ?? 0;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function indexPath(projectId: string): string {
  return path.join(DATA_DIR, `${projectId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
}

export async function saveMemoryIndex(index: MemoryIndex): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(indexPath(index.projectId), JSON.stringify(index), "utf8");
}

export async function loadMemoryIndex(projectId: string): Promise<MemoryIndex | null> {
  try {
    const raw = await fs.readFile(indexPath(projectId), "utf8");
    return JSON.parse(raw) as MemoryIndex;
  } catch {
    return null;
  }
}

export function appendChunk(index: MemoryIndex, chunk: Omit<MemoryChunk, "terms"> & { terms?: Record<string, number> }): MemoryChunk {
  const full: MemoryChunk = {
    ...chunk,
    terms: chunk.terms ?? termVector(`${chunk.title} ${chunk.content}`),
    updatedAt: chunk.updatedAt ?? new Date().toISOString(),
  };
  index.chunks = index.chunks.filter((c) => c.id !== full.id);
  index.chunks.push(full);
  index.chunkCount = index.chunks.length;
  return full;
}

export function searchIndex(index: MemoryIndex, query: string, limit = 12): Array<{ chunk: MemoryChunk; score: number }> {
  const qv = termVector(query);
  const scored = index.chunks
    .map((chunk) => ({
      chunk,
      score: cosineSimilarity(qv, chunk.terms),
    }))
    .filter((s) => s.score > 0.05)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored;
}
