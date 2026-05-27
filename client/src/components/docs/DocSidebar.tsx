import { DOC_CATEGORIES, DOC_SECTIONS } from "../../data/docs/sections";
import type { DocCategory } from "../../data/docs/types";
import { DocSearch } from "./DocSearch";
import type { DocSearchHit } from "../../data/docs/types";

type Props = {
  activeId: string;
  query: string;
  categoryFilter: DocCategory | "all";
  searchHits: DocSearchHit[];
  onQueryChange: (q: string) => void;
  onCategoryChange: (c: DocCategory | "all") => void;
  onSelect: (id: string) => void;
};

export function DocSidebar({
  activeId,
  query,
  categoryFilter,
  searchHits,
  onQueryChange,
  onCategoryChange,
  onSelect,
}: Props) {
  return (
    <aside className="htu-sidebar">
      <DocSearch
        query={query}
        categoryFilter={categoryFilter}
        hits={searchHits}
        onQueryChange={onQueryChange}
        onCategoryChange={onCategoryChange}
        onSelectSection={onSelect}
      />
      <nav aria-label="Documentation sections">
        {DOC_CATEGORIES.map((cat) => {
          const items = DOC_SECTIONS.filter((s) => s.category === cat.id);
          if (items.length === 0) return null;
          return (
            <div key={cat.id} className="htu-nav-group">
              <p className="htu-nav-group-title">{cat.label}</p>
              {items.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`htu-nav-link${activeId === s.id ? " active" : ""}`}
                  onClick={() => onSelect(s.id)}
                >
                  {s.title}
                </button>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
