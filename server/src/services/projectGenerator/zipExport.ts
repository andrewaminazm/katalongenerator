import fs from "node:fs/promises";
import path from "node:path";
import AdmZip from "adm-zip";
import type { GeneratedFile } from "./types.js";
import { generationZipPath } from "./cache.js";

export async function assembleProjectZip(
  generationId: string,
  files: GeneratedFile[]
): Promise<string> {
  const zipPath = generationZipPath(generationId);
  await fs.mkdir(path.dirname(zipPath), { recursive: true });

  const zip = new AdmZip();
  for (const f of files) {
    if (f.path.endsWith("/.gitkeep") && !f.content) {
      zip.addFile(f.path, Buffer.alloc(0));
    } else if (f.content || !f.path.endsWith(".gitkeep")) {
      zip.addFile(f.path, Buffer.from(f.content, "utf8"));
    }
  }
  zip.writeZip(zipPath);
  return zipPath;
}

export async function readZipBuffer(generationId: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(generationZipPath(generationId));
  } catch {
    return null;
  }
}
