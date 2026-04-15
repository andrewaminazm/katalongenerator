import type { KatalonProjectContext } from "../types/index.js";

function uniqSorted(paths: string[]): string[] {
  return [...new Set(paths.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

export interface KatalonImportedPathSets {
  objectRepository?: string[];
  testCases?: string[];
  testSuites?: string[];
}

/**
 * Merges XML-derived project context with paths from partial ZIP / file imports.
 */
export function mergeKatalonImportedAssets(
  xmlContext: KatalonProjectContext | undefined,
  imported: KatalonImportedPathSets
): KatalonProjectContext | undefined {
  const or = uniqSorted([
    ...(xmlContext?.objectRepository ?? []),
    ...(imported.objectRepository ?? []),
  ]);
  const tc = uniqSorted([...(xmlContext?.testCases ?? []), ...(imported.testCases ?? [])]);
  const ts = uniqSorted([...(xmlContext?.testSuites ?? []), ...(imported.testSuites ?? [])]);

  if (
    !xmlContext &&
    or.length === 0 &&
    tc.length === 0 &&
    ts.length === 0
  ) {
    return undefined;
  }

  if (!xmlContext) {
    return {
      objectRepository: or.length ? or : undefined,
      testCases: tc.length ? tc : undefined,
      testSuites: ts.length ? ts : undefined,
    };
  }

  return {
    ...xmlContext,
    objectRepository: or.length ? or : xmlContext.objectRepository,
    testCases: tc.length ? tc : xmlContext.testCases,
    testSuites: ts.length ? ts : xmlContext.testSuites,
  };
}

/** @deprecated Use mergeKatalonImportedAssets with { objectRepository: paths } */
export function mergeKatalonProjectPaths(
  xmlContext: KatalonProjectContext | undefined,
  importedPaths: string[]
): KatalonProjectContext | undefined {
  return mergeKatalonImportedAssets(xmlContext, { objectRepository: importedPaths });
}

export function contextHasAnyAssets(ctx: KatalonProjectContext | undefined): boolean {
  if (!ctx) return false;
  return Boolean(
    ctx.sourceXml?.trim() ||
      (ctx.objectRepository?.length ?? 0) > 0 ||
      (ctx.keywords?.length ?? 0) > 0 ||
      (ctx.testCases?.length ?? 0) > 0 ||
      (ctx.testSuites?.length ?? 0) > 0 ||
      ctx.projectName ||
      ctx.frameworkType
  );
}
