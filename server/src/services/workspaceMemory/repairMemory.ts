import { loadCachedRepair, indexFingerprint } from "../projectRepair/cache.js";
import { loadProjectIndex } from "../projectIntelligence/index.js";
import type { MemoryIndex } from "./types.js";
import { appendChunk } from "./vectorStore.js";

export async function ingestRepairMemory(index: MemoryIndex): Promise<void> {
  const projectIndex = await loadProjectIndex(index.projectId);
  if (!projectIndex) return;

  const cached = await loadCachedRepair(index.projectId, indexFingerprint(projectIndex));
  if (!cached) return;

  appendChunk(index, {
    id: "repair-latest",
    projectId: index.projectId,
    layer: "repair",
    title: "Latest repair analysis",
    content: [
      `Health: ${cached.healthScore}, Flakiness: ${cached.flakinessScore}`,
      `Suggestions: ${cached.repairSuggestions.length}`,
      `Locator repairs: ${cached.locatorRepairs.length}`,
      `Top issues: ${cached.repairSuggestions.slice(0, 5).map((s) => s.title).join("; ")}`,
    ].join("\n"),
    confidence: 0.85,
    source: "project_repair_engine",
    updatedAt: cached.analyzedAt,
  });

  for (const r of cached.riskAreas.slice(0, 8)) {
    appendChunk(index, {
      id: `risk-${r.module}`,
      projectId: index.projectId,
      layer: "risk",
      title: `Risk module: ${r.module}`,
      content: `Risk score ${r.riskScore}. Reasons: ${r.reasons.join(", ")}`,
      confidence: r.riskScore / 100,
      source: "repair_risk",
      updatedAt: cached.analyzedAt,
    });
  }

  for (const l of cached.locatorRepairs.slice(0, 10)) {
    appendChunk(index, {
      id: `locator-repair-${l.orPath.replace(/[^a-zA-Z0-9]/g, "_")}`,
      projectId: index.projectId,
      layer: "locator",
      title: `Locator: ${l.label}`,
      content: `${l.problem}. Old: ${l.oldLocator.type} ${l.oldLocator.value.slice(0, 80)}${l.newLocator ? `. Suggested: ${l.newLocator.value.slice(0, 80)}` : ""}`,
      confidence: l.confidence,
      source: "locator_healing",
      updatedAt: cached.analyzedAt,
    });
  }
}
