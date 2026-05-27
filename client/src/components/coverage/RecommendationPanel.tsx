type Rec = {
  id: string;
  severity: string;
  category: string;
  title: string;
  detail: string;
  affectedItems?: string[];
};

export function RecommendationPanel({ items }: { items: Rec[] }) {
  if (!items.length) {
    return <p className="cov-empty">No recommendations — strong coverage signals.</p>;
  }

  return (
    <div>
      {items.map((r) => (
        <article key={r.id} className="cov-rec">
          <h3>
            <span className={`cov-sev cov-sev--${r.severity}`}>{r.severity}</span>{" "}
            {r.title}
          </h3>
          <p>{r.detail}</p>
          {r.affectedItems && r.affectedItems.length > 0 && (
            <p style={{ marginTop: "0.35rem", fontSize: "0.7rem" }}>
              {r.affectedItems.slice(0, 5).join(" · ")}
              {r.affectedItems.length > 5 ? ` (+${r.affectedItems.length - 5} more)` : ""}
            </p>
          )}
        </article>
      ))}
    </div>
  );
}
