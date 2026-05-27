import type { MemorySearchHit, MemorySearchResult, RetrievalContext } from "./types.js";
import { getOrBuildMemoryIndex } from "./memoryEngine.js";
import { searchIndex } from "./vectorStore.js";

export async function searchWorkspaceMemory(
  projectId: string,
  query: string,
  limit = 10
): Promise<MemorySearchResult> {
  const index = await getOrBuildMemoryIndex(projectId);
  if (!index) throw new Error("Project not found");

  const hits: MemorySearchHit[] = searchIndex(index, query, limit).map(({ chunk, score }) => ({
    chunk,
    score: Math.round(score * 100) / 100,
    whyRelevant: `Semantic match (${chunk.layer}): ${chunk.title}`,
  }));

  return {
    projectId,
    query,
    hits,
    searchedAt: new Date().toISOString(),
  };
}

export async function retrieveForChat(
  projectId: string | undefined,
  userMessage: string,
  limit = 8
): Promise<RetrievalContext | null> {
  if (!projectId?.trim()) return null;

  const index = await getOrBuildMemoryIndex(projectId);
  if (!index || index.chunks.length === 0) return null;

  const hits = searchIndex(index, userMessage, limit);
  if (hits.length === 0) {
    const fallback = searchIndex(index, "framework flow api locator repair architecture", 6);
    hits.push(...fallback);
  }

  const lines: string[] = [
    "=== WORKSPACE MEMORY (enterprise QA intelligence — cite when relevant) ===",
    `Project: ${index.projectName} · ${index.chunkCount} memory entries`,
    "",
  ];

  const citations: RetrievalContext["citations"] = [];

  for (const { chunk, score } of hits) {
    if (score < 0.08) continue;
    citations.push({
      id: chunk.id,
      layer: chunk.layer,
      title: chunk.title,
      score: Math.round(score * 100) / 100,
    });
    lines.push(
      `[${chunk.layer}] ${chunk.title} (confidence ${(chunk.confidence * 100).toFixed(0)}%, relevance ${(score * 100).toFixed(0)}%)`,
      chunk.content.slice(0, 600),
      ""
    );
  }

  lines.push(
    "RULES: Use memories to answer architecture/flow/locator/API/repair questions.",
    "Explain which memory entries informed your answer when making recommendations.",
    "=== END WORKSPACE MEMORY ===",
    ""
  );

  return {
    injectionText: lines.join("\n").slice(0, 12000),
    citations,
    hitCount: citations.length,
  };
}
