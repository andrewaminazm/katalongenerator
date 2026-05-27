import { randomUUID } from "node:crypto";
import type { RepairDiff, RollbackSnapshot } from "./types.js";
import { loadRollbackSnapshot, saveRollbackSnapshot } from "./cache.js";

export async function createRollbackSnapshot(input: {
  repairId: string;
  projectId: string;
  diffs: RepairDiff[];
}): Promise<RollbackSnapshot> {
  const snapshot: RollbackSnapshot = {
    rollbackId: randomUUID().slice(0, 12),
    repairId: input.repairId,
    projectId: input.projectId,
    createdAt: new Date().toISOString(),
    files: input.diffs
      .filter((d) => d.changed)
      .map((d) => ({ filePath: d.filePath, original: d.original })),
  };
  await saveRollbackSnapshot(snapshot);
  return snapshot;
}

export async function getRollbackSnapshot(
  rollbackId: string
): Promise<RollbackSnapshot | null> {
  return loadRollbackSnapshot(rollbackId);
}
