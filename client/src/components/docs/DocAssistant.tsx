import { useMemo, useState } from "react";
import { searchDocumentation } from "../../data/docs/search";
import { getSectionById } from "../../data/docs/search";

const QUICK_QUESTIONS = [
  { q: "How do I upload a project?", search: "project upload" },
  { q: "How does Gosi Brain Workspace work?", search: "ai qa workspace" },
  { q: "How does locator healing work?", search: "locator healing" },
  { q: "Why did generation fail?", search: "troubleshooting generate" },
  { q: "How do I run performance tests?", search: "jmeter k6" },
  { q: "Explain API Test tab", search: "api automation" },
] as const;

type Props = {
  onJumpToSection: (id: string) => void;
};

export function DocAssistant({ onJumpToSection }: Props) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [relatedId, setRelatedId] = useState<string | null>(null);

  const handleQuestion = (search: string) => {
    const hits = searchDocumentation(search, "all");
    const top = hits[0];
    if (!top) {
      setAnswer("No matching topic found. Try the search box in the sidebar.");
      setRelatedId(null);
      return;
    }
    const section = getSectionById(top.sectionId);
    if (!section) return;
    setRelatedId(section.id);
    setAnswer(
      `${section.summary}\n\n${section.steps?.[0] ?? section.content.slice(0, 280)}…`
    );
  };

  const relatedTitle = useMemo(() => {
    if (!relatedId) return null;
    return getSectionById(relatedId)?.title ?? null;
  }, [relatedId]);

  return (
    <div className="htu-assistant">
      {open && (
        <div className="htu-assistant-panel" role="dialog" aria-label="Documentation assistant">
          <header>Help assistant</header>
          <div className="htu-assistant-body">
            <p style={{ margin: "0 0 0.5rem", color: "var(--muted)" }}>
              Pick a question — opens the related guide section.
            </p>
            {QUICK_QUESTIONS.map((item) => (
              <button
                key={item.q}
                type="button"
                className="htu-assistant-q"
                onClick={() => handleQuestion(item.search)}
              >
                {item.q}
              </button>
            ))}
            {answer && (
              <div className="htu-assistant-answer">
                {answer}
                {relatedId && relatedTitle && (
                  <button
                    type="button"
                    className="htu-btn htu-btn-primary"
                    style={{ marginTop: "0.65rem", width: "100%", justifyContent: "center" }}
                    onClick={() => {
                      onJumpToSection(relatedId);
                      setOpen(false);
                    }}
                  >
                    Open: {relatedTitle}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <button
        type="button"
        className="htu-assistant-toggle"
        aria-expanded={open}
        aria-label={open ? "Close help assistant" : "Open help assistant"}
        onClick={() => setOpen((v) => !v)}
      >
        ?
      </button>
    </div>
  );
}
