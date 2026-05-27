import { randomUUID } from "node:crypto";
import type { LearnMemoryInput, MemoryIndex } from "./types.js";
import { appendChunk, loadMemoryIndex, saveMemoryIndex } from "./vectorStore.js";

export async function learnFromInput(input: LearnMemoryInput): Promise<MemoryIndex> {
  let index = await loadMemoryIndex(input.projectId);
  if (!index) {
    index = {
      projectId: input.projectId,
      projectName: input.projectId,
      indexedAt: new Date().toISOString(),
      chunkCount: 0,
      chunks: [],
    };
  }

  appendChunk(index, {
    id: `learn-${randomUUID().slice(0, 8)}`,
    projectId: input.projectId,
    layer: input.layer,
    title: input.title,
    content: input.content,
    confidence: input.source === "user_approval" ? 0.95 : 0.7,
    source: input.source ?? "chat",
    updatedAt: new Date().toISOString(),
  });

  await saveMemoryIndex(index);
  return index;
}
