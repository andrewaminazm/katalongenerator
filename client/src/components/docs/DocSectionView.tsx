import type { DocSection } from "../../data/docs/types";
import { DOC_CATEGORIES } from "../../data/docs/sections";
import { CopyCodeButton } from "./CopyCodeButton";
import { DocStepFlow } from "./DocStepFlow";

type Props = {
  section: DocSection;
};

function categoryLabel(category: DocSection["category"]): string {
  return DOC_CATEGORIES.find((c) => c.id === category)?.label ?? category;
}

export function DocSectionView({ section }: Props) {
  return (
    <article className="htu-section" id={section.id}>
      <header className="htu-section-header">
        <h2>{section.title}</h2>
        <span className="htu-badge">{categoryLabel(section.category)}</span>
        <p className="htu-prose" style={{ marginTop: "0.5rem", whiteSpace: "normal" }}>
          {section.summary}
        </p>
      </header>

      <div className="htu-prose">{section.content}</div>

      {section.mediaPlaceholders && section.mediaPlaceholders.length > 0 && (
        <div className="htu-media-placeholder" role="img" aria-label="Screenshot placeholder">
          📷 {section.mediaPlaceholders[0]}
          {section.mediaPlaceholders.length > 1 && (
            <span style={{ display: "block", marginTop: "0.35rem", fontSize: "0.7rem" }}>
              +{section.mediaPlaceholders.length - 1} more visual(s) — wire assets in{" "}
              <code>public/docs/</code>
            </span>
          )}
        </div>
      )}

      {section.steps && section.steps.length > 0 && (
        <>
          <h3 style={{ fontSize: "var(--text-medium)", margin: "1.5rem 0 0.5rem" }}>Workflow</h3>
          <DocStepFlow steps={section.steps} />
        </>
      )}

      {section.examples && section.examples.length > 0 && (
        <div className="htu-block">
          <h3>Examples</h3>
          {section.examples.map((ex) => (
            <pre key={ex} className="htu-example">
              <CopyCodeButton text={ex} />
              {ex}
            </pre>
          ))}
        </div>
      )}

      {section.tips && section.tips.length > 0 && (
        <div className="htu-block htu-block--tip">
          <h3>💡 Tips</h3>
          <ul>
            {section.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {section.warnings && section.warnings.length > 0 && (
        <div className="htu-block htu-block--warn">
          <h3>⚠️ Warnings</h3>
          <ul>
            {section.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {section.mistakes && section.mistakes.length > 0 && (
        <div className="htu-block htu-block--mistake">
          <h3>Common mistakes</h3>
          <ul>
            {section.mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
