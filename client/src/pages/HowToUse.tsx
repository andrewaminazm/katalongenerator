import { useCallback, useEffect, useMemo, useState } from "react";
import { DOC_SECTIONS } from "../data/docs/sections";
import { searchDocumentation } from "../data/docs/search";
import type { DocCategory } from "../data/docs/types";
import { DocAssistant } from "../components/docs/DocAssistant";
import { DocSectionView } from "../components/docs/DocSectionView";
import { DocSidebar } from "../components/docs/DocSidebar";
import "../components/docs/howToUse.css";

function readHashSection(): string {
  const raw = window.location.hash.replace(/^#/, "");
  if (!raw) return DOC_SECTIONS[0]?.id ?? "getting-started";
  return raw;
}

export default function HowToUse() {
  const [activeId, setActiveId] = useState(readHashSection);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<DocCategory | "all">("all");
  const [focusSingle, setFocusSingle] = useState(false);

  const searchHits = useMemo(
    () => searchDocumentation(query, categoryFilter),
    [query, categoryFilter]
  );

  const visibleSections = useMemo(() => {
    if (!query.trim() && categoryFilter === "all") return DOC_SECTIONS;
    const ids = new Set(searchHits.map((h) => h.sectionId));
    if (ids.size === 0 && query.trim()) return [];
    return DOC_SECTIONS.filter((s) => {
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      if (query.trim()) return ids.has(s.id);
      return true;
    });
  }, [query, categoryFilter, searchHits]);

  const jumpTo = useCallback((id: string, single = false) => {
    setActiveId(id);
    setFocusSingle(single);
    window.history.replaceState(null, "", `/how-to-use#${id}`);
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useEffect(() => {
    const onHash = () => {
      const id = readHashSection();
      setActiveId(id);
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    document.title = "Documentation — Katalon Script Generator";
    return () => {
      document.title = "Katalon Script Generator";
    };
  }, []);

  return (
    <div className="htu-root">
      <header className="htu-header">
        <div className="htu-header-brand">
          <h1>Documentation</h1>
          <p>Katalon Script Generator — guides, workflows, and troubleshooting</p>
        </div>
        <div className="htu-header-actions">
          <button
            type="button"
            className="htu-btn"
            onClick={() => {
              setFocusSingle(false);
              setQuery("");
              setCategoryFilter("all");
            }}
          >
            Show all topics
          </button>
          <a href="/video-tutorials" className="htu-btn">
            Video tutorials
          </a>
          <a href="/" className="htu-btn htu-btn-primary">
            ← Back to Generator
          </a>
        </div>
      </header>

      <div className="htu-layout">
        <DocSidebar
          activeId={activeId}
          query={query}
          categoryFilter={categoryFilter}
          searchHits={searchHits}
          onQueryChange={(q) => {
            setQuery(q);
            setFocusSingle(false);
          }}
          onCategoryChange={setCategoryFilter}
          onSelect={(id) => jumpTo(id, Boolean(query.trim()))}
        />

        <main className={`htu-main${focusSingle ? " htu-single-view" : ""}`}>
          {visibleSections.length === 0 ? (
            <p className="htu-prose">No sections match your search. Clear filters or try another keyword.</p>
          ) : focusSingle ? (
            (() => {
              const section = visibleSections.find((s) => s.id === activeId) ?? visibleSections[0];
              return section ? <DocSectionView section={section} /> : null;
            })()
          ) : (
            visibleSections.map((section) => <DocSectionView key={section.id} section={section} />)
          )}
        </main>
      </div>

      <DocAssistant onJumpToSection={(id) => jumpTo(id, true)} />
    </div>
  );
}
