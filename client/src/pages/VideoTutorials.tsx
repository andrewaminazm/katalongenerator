import { useCallback, useEffect, useMemo, useState } from "react";
import {
  VIDEO_TUTORIALS,
  VIDEO_TUTORIAL_CATEGORIES,
  getVideoTutorialById,
  type VideoTutorialCategory,
} from "../data/tutorials/videoCatalog";
import { useLayoutContext } from "../components/layout/LayoutContext";
import { PageInfoGuide } from "../components/PageInfoGuide";
import { VideoEmbed } from "../components/tutorials/VideoEmbed";
import { TutorialFeatureList } from "../components/tutorials/TutorialFeatureList";
import "../components/tutorials/videoTutorials.css";

function readHashTutorialId(): string | null {
  const raw = window.location.hash.replace(/^#/, "").trim();
  if (!raw) return null;
  return getVideoTutorialById(raw) ? raw : null;
}

function navigateHref(href: string) {
  if (href.startsWith("/#")) {
    window.location.href = href;
    return;
  }
  window.history.pushState({}, "", href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function VideoTutorials() {
  const { embedded } = useLayoutContext();
  const [category, setCategory] = useState<VideoTutorialCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    () => readHashTutorialId() ?? VIDEO_TUTORIALS[0]?.id ?? ""
  );

  const selectTutorial = useCallback((id: string) => {
    setSelectedId(id);
    const url = `/video-tutorials#${id}`;
    window.history.replaceState(null, "", url);
    document.getElementById("vt-main-player")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  useEffect(() => {
    document.title = "Video Tutorials — Katalon Script Generator";
    const onHash = () => {
      const id = readHashTutorialId();
      if (id) setSelectedId(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => {
      window.removeEventListener("hashchange", onHash);
      document.title = "Katalon Script Generator";
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return VIDEO_TUTORIALS.filter((v) => {
      if (category !== "all" && v.category !== category) return false;
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.category.includes(q)
      );
    });
  }, [category, query]);

  const selected = useMemo(() => {
    return (
      getVideoTutorialById(selectedId) ??
      filtered.find((v) => v.id === selectedId) ??
      filtered[0] ??
      VIDEO_TUTORIALS[0]
    );
  }, [filtered, selectedId]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((v) => v.id === selectedId)) {
      selectTutorial(filtered[0].id);
    }
  }, [filtered, selectedId, selectTutorial]);

  return (
    <div className={embedded ? "vt-root vt-root--embedded" : "vt-root"}>
      {!embedded && (
        <header className="vt-header">
          <h1>Video Tutorials</h1>
          <p>
            Select a feature on the left — the main player loads that lesson. Written guides are in
            Documentation.
          </p>
        </header>
      )}

      <PageInfoGuide title="How this works">
        <ul>
          <li>
            Click any <strong>feature name</strong> in the list to play its step-by-step demo in the main
            player — each lesson shows real UI actions (typing steps, clicking Generate, loading samples, etc.).
          </li>
          <li>Filter by category or search to narrow the list.</li>
          <li>
            Use <strong>Open feature</strong> or <strong>Read guide</strong> under the player for next
            steps.
          </li>
        </ul>
      </PageInfoGuide>

      <div className="vt-toolbar">
        <input
          type="search"
          className="vt-search"
          placeholder="Search features…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search video tutorials"
        />
        <div className="vt-filters" role="group" aria-label="Filter by category">
          <button
            type="button"
            className={`vt-filter-btn${category === "all" ? " vt-filter-btn--active" : ""}`}
            onClick={() => setCategory("all")}
          >
            All
          </button>
          {VIDEO_TUTORIAL_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`vt-filter-btn${category === c.id ? " vt-filter-btn--active" : ""}`}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="vt-layout">
        <aside className="vt-sidebar" aria-label="Feature tutorials">
          <p className="vt-sidebar-heading">Features</p>
          <TutorialFeatureList
            tutorials={filtered}
            selectedId={selected?.id ?? ""}
            onSelect={selectTutorial}
          />
        </aside>

        <div className="vt-main">
          {selected ? (
            <section
              id="vt-main-player"
              className="vt-player-panel"
              aria-label={`Now playing: ${selected.title}`}
            >
              <p className="vt-now-playing">
                Now playing · <strong>{selected.title}</strong>
                {selected.durationLabel ? (
                  <span className="vt-now-playing-duration"> · {selected.durationLabel}</span>
                ) : null}
              </p>
              <VideoEmbed key={selected.id} video={selected} autoPlayOnChange />
              <div className="vt-player-meta">
                <h2>{selected.title}</h2>
                <p>{selected.description}</p>
                <div className="vt-player-actions">
                  {selected.relatedHref && (
                    <button
                      type="button"
                      className="vt-link-btn vt-link-btn--primary"
                      onClick={() => navigateHref(selected.relatedHref!)}
                    >
                      Open feature
                    </button>
                  )}
                  {selected.docSectionId && (
                    <button
                      type="button"
                      className="vt-link-btn"
                      onClick={() => navigateHref(`/how-to-use#${selected.docSectionId}`)}
                    >
                      Read guide
                    </button>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <p className="vt-empty">No tutorials match your search. Try another keyword or category.</p>
          )}
        </div>
      </div>
    </div>
  );
}
