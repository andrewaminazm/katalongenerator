import type { DocCategory, DocSearchHit } from "../../data/docs/types";
import { DOC_CATEGORIES } from "../../data/docs/sections";

type Props = {
  query: string;
  categoryFilter: DocCategory | "all";
  hits: DocSearchHit[];
  onQueryChange: (q: string) => void;
  onCategoryChange: (c: DocCategory | "all") => void;
  onSelectSection: (id: string) => void;
};

export function DocSearch({
  query,
  categoryFilter,
  hits,
  onQueryChange,
  onCategoryChange,
  onSelectSection,
}: Props) {
  const showHits = query.trim().length > 0;

  return (
    <div className="htu-search">
      <label htmlFor="htu-doc-search" className="sr-only">
        Search documentation
      </label>
      <input
        id="htu-doc-search"
        type="search"
        placeholder="Search e.g. locator healing, JMeter…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        autoComplete="off"
      />
      <div className="htu-filter-row" role="group" aria-label="Filter by category">
        <button
          type="button"
          className={`htu-filter-chip${categoryFilter === "all" ? " active" : ""}`}
          onClick={() => onCategoryChange("all")}
        >
          All
        </button>
        {DOC_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`htu-filter-chip${categoryFilter === c.id ? " active" : ""}`}
            onClick={() => onCategoryChange(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
      {showHits && (
        <div className="htu-search-hits">
          {hits.length === 0 ? (
            <p style={{ fontSize: "var(--text-small)", color: "var(--muted)", margin: 0 }}>
              No matches. Try synonyms like &quot;OR&quot;, &quot;load test&quot;, or &quot;record&quot;.
            </p>
          ) : (
            hits.slice(0, 8).map((hit) => (
              <button
                key={hit.sectionId}
                type="button"
                className="htu-search-hit"
                onClick={() => onSelectSection(hit.sectionId)}
              >
                <strong>{hit.title}</strong>
                <span>{hit.snippet}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
