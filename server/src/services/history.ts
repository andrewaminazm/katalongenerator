import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import type { HistoryEntry } from "../types/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

const MAX_ENTRIES = 200;

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(HISTORY_FILE);
  } catch {
    await fs.writeFile(HISTORY_FILE, "[]", "utf8");
  }
}

export async function appendHistory(entry: Omit<HistoryEntry, "id" | "createdAt">): Promise<HistoryEntry> {
  await ensureFile();
  const full: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const raw = await fs.readFile(HISTORY_FILE, "utf8");
  let list: HistoryEntry[] = [];
  try {
    list = JSON.parse(raw) as HistoryEntry[];
  } catch {
    list = [];
  }
  list.unshift(full);
  if (list.length > MAX_ENTRIES) list = list.slice(0, MAX_ENTRIES);
  await fs.writeFile(HISTORY_FILE, JSON.stringify(list, null, 2), "utf8");
  return full;
}

export async function listHistory(limit = 50): Promise<HistoryEntry[]> {
  await ensureFile();
  const raw = await fs.readFile(HISTORY_FILE, "utf8");
  try {
    const list = JSON.parse(raw) as HistoryEntry[];
    return list.slice(0, limit);
  } catch {
    return [];
  }
}

export async function clearHistory(): Promise<void> {
  await ensureFile();
  await fs.writeFile(HISTORY_FILE, "[]", "utf8");
}
