import { CHAT_EXAMPLE_CATEGORIES } from "../../data/chatGenerationExamples";
import { SENIOR_QA_ENGINEER_NAME } from "../../data/seniorQaEngineer";

type Props = {
  onPick: (text: string) => void;
  disabled?: boolean;
};

export function ChatGenerationExamples({ onPick, disabled }: Props) {
  return (
    <div className="aiw-gen-examples" role="region" aria-label="Chat capability examples">
      <div className="aiw-gen-examples-header">
        <h2 className="aiw-gen-examples-title">What you can do in chat</h2>
        <p className="aiw-gen-examples-intro">
          <strong>{SENIOR_QA_ENGINEER_NAME}</strong> handles project review, API and performance
          guidance, Katalon Groovy generation, Arabic and English, and long conversations. Click any example
          to send it — no dropdowns needed.
        </p>
      </div>

      {CHAT_EXAMPLE_CATEGORIES.map((category) => (
        <section key={category.id} className="aiw-gen-example-section">
          <div className="aiw-gen-example-section-head">
            <h3 className="aiw-gen-example-section-title">{category.title}</h3>
            <p className="aiw-gen-example-section-desc">{category.description}</p>
          </div>
          <div className="aiw-gen-examples-grid">
            {category.examples.map((ex) => (
              <button
                key={ex.id}
                type="button"
                className="aiw-gen-example-card"
                disabled={disabled}
                onClick={() => onPick(ex.prompt)}
                title={ex.hint ? `${ex.prompt}\n\nNote: ${ex.hint}` : ex.prompt}
              >
                <span className="aiw-gen-example-label">{ex.label}</span>
                <span className="aiw-gen-example-preview">{ex.prompt.split("\n")[0]}</span>
                {ex.hint ? <span className="aiw-gen-example-hint">{ex.hint}</span> : null}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
