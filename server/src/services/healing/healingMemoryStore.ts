import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { FallbackLocator, HealingMemoryEntry } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "healing-memory.json");

const MAX_ENTRIES = 500;

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(MEMORY_FILE);
  } catch {
    await fs.writeFile(MEMORY_FILE, JSON.stringify({ entries: [] }, null, 2), "utf8");
  }
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function simpleDomSignature(failedType: string, failedValue: string, snapshot?: string): string {
  const base = `${failedType}|${failedValue}`;
  const extra = snapshot?.slice(0, 2000) ?? "";
  return crypto.createHash("sha256").update(base + extra).digest("hex").slice(0, 24);
}

export async function lookupHealingMemory(options: {
  url: string;
  stepId: string;
  failedLocator: { type: string; value: string };
  domSnapshot?: string;
}): Promise<FallbackLocator | null> {
  await ensureFile();
  const raw = await fs.readFile(MEMORY_FILE, "utf8");
  let entries: HealingMemoryEntry[] = [];
  try {
    entries = (JSON.parse(raw) as { entries?: HealingMemoryEntry[] }).entries ?? [];
  } catch {
    entries = [];
  }
  const host = hostFromUrl(options.url);
  const sig = simpleDomSignature(
    options.failedLocator.type,
    options.failedLocator.value,
    options.domSnapshot
  );

  const hit = entries.find(
    (e) =>
      e.urlPattern === host &&
      e.stepId === options.stepId &&
      e.domSignature === sig
  );
  if (!hit) return null;

  return {
    type: hit.locatorType,
    value: hit.locatorValue,
    score: 100,
    source: "memory",
  };
}

export async function saveHealingSuccess(options: {
  url: string;
  stepId: string;
  failedLocator: { type: string; value: string };
  domSnapshot?: string;
  winning: FallbackLocator;
}): Promise<HealingMemoryEntry> {
  await ensureFile();
  const raw = await fs.readFile(MEMORY_FILE, "utf8");
  let entries: HealingMemoryEntry[] = [];
  try {
    entries = (JSON.parse(raw) as { entries?: HealingMemoryEntry[] }).entries ?? [];
  } catch {
    entries = [];
  }

  const host = hostFromUrl(options.url);
  const sig = simpleDomSignature(
    options.failedLocator.type,
    options.failedLocator.value,
    options.domSnapshot
  );

  const now = new Date().toISOString();
  const idx = entries.findIndex(
    (e) => e.urlPattern === host && e.stepId === options.stepId && e.domSignature === sig
  );

  if (idx >= 0) {
    entries[idx].locatorType = String(options.winning.type);
    entries[idx].locatorValue = options.winning.value;
    entries[idx].lastHitAt = now;
    entries[idx].hitCount = (entries[idx].hitCount ?? 0) + 1;
    await fs.writeFile(MEMORY_FILE, JSON.stringify({ entries }, null, 2), "utf8");
    return entries[idx];
  }

  const entry: HealingMemoryEntry = {
    id: crypto.randomUUID(),
    urlPattern: host,
    stepId: options.stepId,
    domSignature: sig,
    locatorType: String(options.winning.type),
    locatorValue: options.winning.value,
    createdAt: now,
    lastHitAt: now,
    hitCount: 1,
  };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(0, MAX_ENTRIES);
  await fs.writeFile(MEMORY_FILE, JSON.stringify({ entries }, null, 2), "utf8");
  return entry;
}

export async function listHealingMemory(limit = 50): Promise<HealingMemoryEntry[]> {
  await ensureFile();
  const raw = await fs.readFile(MEMORY_FILE, "utf8");
  try {
    const entries = (JSON.parse(raw) as { entries?: HealingMemoryEntry[] }).entries ?? [];
    return entries.slice(0, limit);
  } catch {
    return [];
  }
}
