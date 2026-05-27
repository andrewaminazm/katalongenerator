import { lintGroovy } from "../groovyLint.js";
import type { ArchitecturePlan } from "./architectureEngine.js";
import type { GeneratedFile } from "./types.js";

export function validateGeneratedGroovy(files: GeneratedFile[]): string[] {
  const warnings: string[] = [];
  const knownOr = new Set<string>();

  for (const f of files.filter((x) => x.kind === "or")) {
    knownOr.add(f.path);
  }

  for (const f of files) {
    if (!f.path.endsWith(".groovy") || !f.content.trim()) continue;
    const isKeyword =
      f.path.includes("/Keywords/") || f.kind === "keyword" || f.kind === "page";
    const issues = lintGroovy(f.content, knownOr, {
      keywordTemplate: isKeyword,
      groovyUtility: f.path.includes("/utils/") || f.path.includes("/api/"),
    });
    const errors = issues.filter((i) => i.severity === "error");
    if (errors.length > 0) {
      warnings.push(`${f.path}: ${errors[0].message}`);
    }
    if (/Runtime\.exec|ProcessBuilder/.test(f.content)) {
      warnings.push(`${f.path}: unsafe execution pattern blocked`);
    }
  }

  return warnings;
}

export function dedupeFiles(files: GeneratedFile[]): GeneratedFile[] {
  const map = new Map<string, GeneratedFile>();
  for (const f of files) {
    map.set(f.path, f);
  }
  return [...map.values()];
}

export function buildModuleSummary(
  plan: ArchitecturePlan,
  files: GeneratedFile[]
): { id: string; name: string; layer: "pages" | "keywords" | "api" | "mobile" | "performance" | "data" | "utils"; fileCount: number }[] {
  const layers: Record<string, "pages" | "keywords" | "api" | "mobile" | "performance" | "data" | "utils"> = {
    pages: "pages",
    Keywords: "keywords",
    api: "api",
    mobile: "mobile",
    performance: "performance",
    "Data Files": "data",
    utils: "utils",
  };

  const counts = new Map<string, number>();
  for (const f of files) {
    const segment = f.path.split("/")[1] ?? "root";
    counts.set(segment, (counts.get(segment) ?? 0) + 1);
  }

  return [...counts.entries()].map(([name, fileCount]) => ({
    id: name.toLowerCase(),
    name,
    layer: layers[name] ?? "utils",
    fileCount,
  }));
}
