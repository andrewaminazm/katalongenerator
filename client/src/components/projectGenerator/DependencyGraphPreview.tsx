import type { ProjectGeneratorGenerateResult } from "../../api";

type Props = {
  graph: ProjectGeneratorGenerateResult["dependencyGraph"];
};

export function DependencyGraphPreview({ graph }: Props) {
  return (
    <div className="pg-kv">
      <strong>Nodes</strong>
      <span>{graph.nodes.length}</span>
      <strong>Edges</strong>
      <span>{graph.edges.length}</span>
      <strong>Top edges</strong>
      <span>
        {graph.edges.slice(0, 6).map((e, idx) => (
          <span key={`${e.from}-${e.to}-${idx}`} style={{ display: "block" }}>
            {e.from} → {e.to} ({e.kind})
          </span>
        ))}
      </span>
    </div>
  );
}

