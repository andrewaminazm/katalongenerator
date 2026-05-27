import type {
  DependencyEdge,
  DependencyNode,
  GeneratedFile,
  GeneratedKeyword,
  GeneratedPageObject,
} from "./types.js";

export function buildDependencyGraph(input: {
  pages: GeneratedPageObject[];
  keywords: GeneratedKeyword[];
  apis: GeneratedKeyword[];
  files: GeneratedFile[];
}): { nodes: DependencyNode[]; edges: DependencyEdge[] } {
  const nodes: DependencyNode[] = [];
  const edges: DependencyEdge[] = [];

  for (const p of input.pages) {
    const id = `page:${p.name}`;
    nodes.push({ id, label: p.name, layer: "pages" });
    edges.push({ from: id, to: "kw:AuthenticationHelper", kind: "uses" });
    edges.push({ from: id, to: "kw:ScreenshotUtils", kind: "uses" });
    edges.push({ from: id, to: `or:${p.name.replace("Page", "")}`, kind: "uses" });
  }

  for (const k of input.keywords) {
    const id = `kw:${k.name}`;
    nodes.push({ id, label: k.name, layer: "keywords" });
  }

  for (const a of input.apis) {
    const id = `api:${a.name}`;
    nodes.push({ id, label: a.name, layer: "api" });
    edges.push({ from: "api:RestApiClient", to: "api:AuthManager", kind: "calls" });
  }

  const orModules = new Set<string>();
  for (const f of input.files.filter((x) => x.kind === "or")) {
    const parts = f.path.split("/");
    const mod = parts[parts.indexOf("Object Repository") + 1] ?? "OR";
    orModules.add(mod);
  }
  for (const mod of orModules) {
    nodes.push({ id: `or:${mod}`, label: `${mod} OR`, layer: "or" });
  }

  return { nodes, edges };
}
