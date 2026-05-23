import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import { createExtractorFromData } from "node-unrar-js";

export type ArchiveKind = "zip" | "rar";

export function detectArchiveKind(filename: string): ArchiveKind | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip")) return "zip";
  if (lower.endsWith(".rar")) return "rar";
  return null;
}

function safeExtractPath(destDir: string, entryName: string): string | null {
  const normalized = entryName.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) return null;
  const root = path.resolve(destDir);
  const full = path.resolve(root, ...normalized.split("/"));
  const rel = path.relative(root, full);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return full;
}

export async function extractZipToDir(zipBuffer: Buffer, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(destDir, true);
}

export async function extractRarToDir(rarBuffer: Buffer, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const data = rarBuffer.buffer.slice(
    rarBuffer.byteOffset,
    rarBuffer.byteOffset + rarBuffer.byteLength
  ) as ArrayBuffer;
  const extractor = await createExtractorFromData({ data });
  const extracted = extractor.extract();
  for (const file of extracted.files) {
    const name = file.fileHeader.name;
    const target = safeExtractPath(destDir, name);
    if (!target) continue;
    if (file.fileHeader.flags.directory) {
      await fs.mkdir(target, { recursive: true });
      continue;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    if (file.extraction) {
      await fs.writeFile(target, Buffer.from(file.extraction));
    }
  }
}

export async function extractArchiveToDir(
  buffer: Buffer,
  destDir: string,
  kind: ArchiveKind
): Promise<void> {
  if (kind === "zip") {
    await extractZipToDir(buffer, destDir);
    return;
  }
  await extractRarToDir(buffer, destDir);
}
