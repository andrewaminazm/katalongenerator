import { useEffect, useState } from "react";
import {
  analyzeRefactor,
  listKatalonProjects,
  type ProjectMeta,
  type RefactorAnalysisResult,
} from "../api";
import { RefactorDashboard } from "../components/refactor/RefactorDashboard";
import "../components/refactor/refactor.css";

export default function RefactoringAssistant() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RefactorAnalysisResult | null>(null);

  useEffect(() => {
    document.title = "AI Refactoring Assistant — Katalon Script Generator";
    listKatalonProjects()
      .then((list) => {
        setProjects(list);
        if (list[0] && !projectId) setProjectId(list[0].projectId);
      })
      .catch(() => setProjects([]));
    return () => {
      document.title = "Katalon Script Generator";
    };
  }, []);

  const run = async (forceRefresh = false) => {
    if (!projectId) {
      setError("Select a project to analyze");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeRefactor({ projectId, forceRefresh });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ref-root">
      <header className="ref-header">
        <div>
          <h1>AI Refactoring Assistant</h1>
          <p>
            SonarQube-style maintainability analysis — duplication, OR, keywords, waits, and architecture
            recommendations (read-only)
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <a href="/" className="ref-btn ref-btn-primary ref-link">
            ← Generator
          </a>
          <a href="/coverage" className="ref-btn ref-link">
            Coverage
          </a>
          <a href="/ai-workspace" className="ref-btn ref-link">
            AI Workspace
          </a>
          <a href="/how-to-use" className="ref-btn ref-link">
            Documentation
          </a>
        </div>
      </header>

      <main className="ref-main">
        <div className="ref-toolbar">
          <label>
            Project
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Select —</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName || p.projectId}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="ref-btn ref-btn-primary"
            disabled={loading || !projectId}
            onClick={() => run(false)}
          >
            {loading ? "Analyzing…" : "Analyze framework"}
          </button>
          <button
            type="button"
            className="ref-btn"
            disabled={loading || !projectId}
            onClick={() => run(true)}
          >
            Force refresh
          </button>
        </div>

        {error && <p className="ref-error">{error}</p>}

        {projects.length === 0 && !loading && (
          <p className="ref-empty">
            Upload and index a Katalon project from the main generator first.
          </p>
        )}

        {result && <RefactorDashboard result={result} />}
      </main>
    </div>
  );
}
