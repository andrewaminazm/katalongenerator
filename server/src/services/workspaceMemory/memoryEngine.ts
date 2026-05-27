import { loadProjectIndex } from "../projectIntelligence/index.js";
import { ingestAssertionMemory } from "./assertionMemory.js";
import { ingestArchitectureMemory } from "./architectureMemory.js";
import { ingestApiMemory } from "./apiMemory.js";
import { ingestFlowMemory } from "./flowMemory.js";
import { ingestLocatorMemory } from "./locatorMemory.js";
import { ingestProjectMemory } from "./projectMemory.js";
import { ingestRepairMemory } from "./repairMemory.js";
import type { MemoryIndex, MemoryInsights } from "./types.js";
import { loadMemoryIndex, saveMemoryIndex } from "./vectorStore.js";
import { buildRecommendations } from "./recommendationEngine.js";
import { buildKnowledgeGraphExport } from "./knowledgeGraph.js";

export async function indexWorkspaceMemory(projectId: string): Promise<MemoryIndex> {
  const projectIndex = await loadProjectIndex(projectId);
  if (!projectIndex) throw new Error("Project not found — upload and index first");

  const index: MemoryIndex = {
    projectId,
    projectName: projectIndex.projectName,
    indexedAt: new Date().toISOString(),
    chunkCount: 0,
    chunks: [],
  };

  await ingestProjectMemory(index, projectIndex);
  ingestFlowMemory(index, projectIndex);
  ingestLocatorMemory(index, projectIndex);
  ingestAssertionMemory(index, projectIndex);
  ingestApiMemory(index, projectIndex);
  ingestArchitectureMemory(index, projectIndex);
  await ingestRepairMemory(index);

  index.chunkCount = index.chunks.length;
  await saveMemoryIndex(index);
  return index;
}

export async function getOrBuildMemoryIndex(projectId: string): Promise<MemoryIndex | null> {
  const existing = await loadMemoryIndex(projectId);
  const projectIndex = await loadProjectIndex(projectId);
  if (!projectIndex) return null;

  if (existing && existing.indexedAt >= projectIndex.uploadDate) {
    return existing;
  }

  return indexWorkspaceMemory(projectId);
}

export async function buildMemoryInsights(projectId: string): Promise<MemoryInsights> {
  const index = await getOrBuildMemoryIndex(projectId);
  if (!index) throw new Error("Project not found");

  const projectIndex = await loadProjectIndex(projectId);
  const layerCounts: Record<string, number> = {};
  for (const c of index.chunks) {
    layerCounts[c.layer] = (layerCounts[c.layer] ?? 0) + 1;
  }

  const graph = projectIndex ? buildKnowledgeGraphExport(projectIndex) : { nodes: [], edges: [] };

  return {
    projectId,
    projectName: index.projectName,
    memoryChunkCount: index.chunkCount,
    layerCounts,
    topFlows: (projectIndex?.reusableFlows ?? []).slice(0, 8).map((f) => ({
      name: f.name,
      description: f.description,
    })),
    repairSummary: index.chunks.find((c) => c.id === "repair-latest")?.content.slice(0, 200),
    riskHints: index.chunks.filter((c) => c.layer === "risk").slice(0, 5).map((c) => c.title),
    recommendations: buildRecommendations(index),
    graphSummary: { nodes: graph.nodes.length, edges: graph.edges.length },
  };
}
