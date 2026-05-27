import type { RefactorRecommendation } from "../../api";
import { CodeComparison } from "./CodeComparison";

type Props = {
  item: RefactorRecommendation;
};

export function RecommendationCard({ item }: Props) {
  return (
    <article className="ref-rec">
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
        <span className={`ref-sev ref-sev--${item.severity}`}>{item.severity}</span>
        <h3>{item.title}</h3>
      </div>
      <p>{item.detail}</p>
      <p>
        <strong>Why:</strong> {item.whyItMatters}
      </p>
      <p>
        <strong>Fix:</strong> {item.suggestedSolution}
      </p>
      <p>
        <strong>Impact:</strong> {item.estimatedImpact}
      </p>
      {(item.beforeExample || item.afterExample) && (
        <CodeComparison before={item.beforeExample} after={item.afterExample} />
      )}
      {item.affectedFiles.length > 0 && (
        <p className="ref-rec-meta">
          Files: {item.affectedFiles.slice(0, 5).join(" · ")}
          {item.affectedFiles.length > 5 ? ` (+${item.affectedFiles.length - 5})` : ""}
        </p>
      )}
      <p className="ref-rec-meta">
        Confidence {Math.round(item.confidence * 100)}% · Fix complexity: {item.fixComplexity}
      </p>
    </article>
  );
}
