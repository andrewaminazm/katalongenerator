import { useEffect, useMemo, useState } from "react";
import {
  VIDEO_TUTORIALS,
  VIDEO_TUTORIAL_CATEGORIES,
  type VideoTutorial,
  type VideoTutorialCategory,
} from "../data/tutorials/videoCatalog";
import { useLayoutContext } from "../components/layout/LayoutContext";
import { PageInfoGuide } from "../components/PageInfoGuide";
import { VideoEmbed } from "../components/tutorials/VideoEmbed";
import { VideoTutorialCard } from "../components/tutorials/VideoTutorialCard";
import "../components/tutorials/videoTutorials.css";

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
  const [selectedId, setSelectedId] = useState(VIDEO_TUTORIALS[0]?.id ?? "");

  useEffect(() => {
    document.title = "Video Tutorials — Katalon Script Generator";
    return () => {
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

  const selected: VideoTutorial | undefined = useMemo(() => {
    const fromList = filtered.find((v) => v.id === selectedId);
    if (fromList) return fromList;
    return filtered[0] ?? VIDEO_TUTORIALS.find((v) => v.id === selectedId);
  }, [filtered, selectedId]);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((v) => v.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  return (
    <div className={embedded ? "vt-root vt-root--embedded" : "vt-root"}>
      {!embedded && (
        <header className="vt-header">
          <h1>Video Tutorials</h1>
          <p>
            Step-by-step walkthroughs for Script Generator, Gosi Brain, Intelligence, and Utilities.
            Pick a lesson below — written guides live in Documentation.
          </p>
        </header>
      )}

      <PageInfoGuide title="How this works">
        <ul>
          <li>Browse by category or search by feature name.</li>
          <li>Select a card to play the lesson in the viewer (YouTube or hosted video).</li>
          <li>
            Use <strong>Open feature</strong> to jump to the tool, or <strong>Read guide</strong> for the
            full written workflow.
          </li>
        </ul>
      </PageInfoGuide>

      <div className="vt-toolbar">
        <input
          type="search"
          className="vt-search"
          placeholder="Search tutorials…"
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

      {selected && (
        <section className="vt-player-panel" aria-label="Selected tutorial">
          <VideoEmbed video={selected} />
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
      )}

      {filtered.length === 0 ? (
        <p className="vt-empty">No tutorials match your search. Try another keyword or category.</p>
      ) : (
        <div className="vt-grid" role="list">
          {filtered.map((video) => (
            <div key={video.id} role="listitem">
              <VideoTutorialCard
                video={video}
                active={video.id === selected?.id}
                onSelect={() => setSelectedId(video.id)}
              />
            </div>
          ))}
        </div>
      )}

      <p className="vt-admin-note">
        To regenerate tutorial videos after copy changes, run{" "}
        <code>npm run tutorials:videos --prefix server</code> (requires Playwright Chromium).{" "}
        <button type="button" className="vt-link-btn" onClick={() => navigateHref("/how-to-use#video-tutorials")}>
          Read publishing guide
        </button>
      </p>
    </div>
  );
}
