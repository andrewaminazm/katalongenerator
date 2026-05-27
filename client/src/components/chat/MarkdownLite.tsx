import { CodeBlock } from "./CodeBlock";

/** Lightweight markdown: paragraphs, bold, lists, fenced code — no extra deps. */
export function MarkdownLite({ text }: { text: string }) {
  const parts = text.split(/(```[\s\S]*?```)/g);

  return (
    <div className="aiw-md">
      {parts.map((part, i) => {
        const fence = part.match(/^```(\w+)?\n?([\s\S]*?)```$/);
        if (fence) {
          return <CodeBlock key={i} code={fence[2].trim()} language={fence[1]} />;
        }
        const lines = part.split(/\n\n+/).filter(Boolean);
        return lines.map((block, j) => {
          const key = `${i}-${j}`;
          if (/^[-*]\s+/m.test(block)) {
            const items = block.split(/\n/).filter((l) => /^[-*]\s+/.test(l));
            return (
              <ul key={key}>
                {items.map((li) => (
                  <li key={li} dangerouslySetInnerHTML={{ __html: inlineHtml(li.replace(/^[-*]\s+/, "")) }} />
                ))}
              </ul>
            );
          }
          return (
            <p key={key} dangerouslySetInnerHTML={{ __html: inlineHtml(block.replace(/\n/g, " ")) }} />
          );
        });
      })}
    </div>
  );
}

function inlineHtml(s: string): string {
  return escapeHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
