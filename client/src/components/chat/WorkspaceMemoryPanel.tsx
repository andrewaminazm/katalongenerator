import { useCallback, useEffect, useState } from "react";
import {
  fetchWorkspaceMemoryInsights,
  indexWorkspaceMemory,
  searchWorkspaceMemory,
  type MemoryInsights,
  type MemorySearchHit,
  type WorkspaceMemoryCitation,
} from "../../api";

interface Props {
  projectId?: string;
  lastCitations?: WorkspaceMemoryCitation[];
}

export function WorkspaceMemoryPanel({ projectId, lastCitations }: Props) {
  const [insights, setInsights] = useState<MemoryInsights | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<MemorySearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const loadInsights = useCallback(async () => {
    if (!projectId) {
      setInsights(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkspaceMemoryInsights(projectId);
      setInsights(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load memory");
      setInsights(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const reindex = async () => {
    if (!projectId) return;
    setIndexing(true);
    setError(null);
    try {
      await indexWorkspaceMemory(projectId);
      await loadInsights();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Index failed");
    } finally {
      setIndexing(false);
    }
  };

  const runSearch = async () => {
    if (!projectId || !searchQuery.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await searchWorkspaceMemory(projectId, searchQuery.trim(), 6);
      setSearchHits(res.hits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  if (!projectId) {
    return (
      <section className="aiw-memory-panel">
        <h3>Workspace memory</h3>
        <p className="aiw-memory-muted">Select a project to load enterprise QA memory.</p>
      </section>
    );
  }

  return (
    <section className="aiw-memory-panel">
      <button
        type="button"
        className="aiw-memory-toggle"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <h3>Workspace memory</h3>
        <span>{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <>
          <p className="aiw-memory-muted">
            Persistent flows, locators, repairs, and architecture — injected into every chat message.
          </p>

          <div className="aiw-memory-actions">
            <button
              type="button"
              className="aiw-btn aiw-btn-secondary"
              disabled={indexing}
              onClick={() => void reindex()}
            >
              {indexing ? "Indexing…" : "Re-index memory"}
            </button>
          </div>

          {loading && !insights && <p className="aiw-memory-muted">Loading insights…</p>}
          {error && <p className="aiw-memory-error">{error}</p>}

          {insights && (
            <div className="aiw-memory-stats">
              <span>{insights.memoryChunkCount} entries</span>
              <span>
                Graph: {insights.graphSummary.nodes} nodes · {insights.graphSummary.edges} edges
              </span>
            </div>
          )}

          {insights && insights.topFlows.length > 0 && (
            <div className="aiw-memory-block">
              <h4>Reusable flows</h4>
              <ul>
                {insights.topFlows.slice(0, 5).map((f) => (
                  <li key={f.name}>
                    <strong>{f.name}</strong>
                    <span>{f.description.slice(0, 80)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights && insights.recommendations.length > 0 && (
            <div className="aiw-memory-block">
              <h4>Recommendations</h4>
              <ul>
                {insights.recommendations.slice(0, 3).map((r) => (
                  <li key={r.id}>
                    <strong>{r.title}</strong>
                    <span>{r.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insights && insights.riskHints.length > 0 && (
            <div className="aiw-memory-block">
              <h4>Risk hints</h4>
              <ul>
                {insights.riskHints.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="aiw-memory-block">
            <h4>Semantic search</h4>
            <div className="aiw-memory-search-row">
              <input
                type="search"
                placeholder="e.g. checkout flow, flaky locator"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void runSearch();
                }}
              />
              <button
                type="button"
                className="aiw-btn aiw-btn-secondary"
                disabled={loading || !searchQuery.trim()}
                onClick={() => void runSearch()}
              >
                Search
              </button>
            </div>
            {searchHits.length > 0 && (
              <ul className="aiw-memory-search-hits">
                {searchHits.map((h) => (
                  <li key={h.chunk.id}>
                    <span className="aiw-memory-layer">{h.chunk.layer}</span>
                    <strong>{h.chunk.title}</strong>
                    <span className="aiw-memory-score">{(h.score * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {lastCitations && lastCitations.length > 0 && (
            <div className="aiw-memory-block">
              <h4>Last reply used</h4>
              <ul>
                {lastCitations.map((c) => (
                  <li key={c.id}>
                    <span className="aiw-memory-layer">{c.layer}</span>
                    {c.title}
                    <span className="aiw-memory-score">{(c.score * 100).toFixed(0)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
