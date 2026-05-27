import { useEffect, useState } from "react";
import {
  analyzeRefactor,
  listKatalonProjects,
  type ProjectMeta,
  type RefactorAnalysisResult,
} from "../api";
import { useLayoutContext } from "../components/layout/LayoutContext";
import { PageInfoGuide } from "../components/PageInfoGuide";
import { RefactorDashboard } from "../components/refactor/RefactorDashboard";
import "../components/refactor/refactor.css";

export default function RefactoringAssistant() {
  const { embedded } = useLayoutContext();
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
    <div className={embedded ? "ref-root ref-root--embedded" : "ref-root"}>
      {!embedded && (
        <header className="ref-header">
          <div>
            <h1>AI Refactoring Assistant</h1>
            <p>
              SonarQube-style maintainability analysis — duplication, OR, keywords, waits, and architecture
              recommendations (read-only)
            </p>
          </div>
        </header>
      )}

      <main className="ref-main">
        <PageInfoGuide title="How this works">
          <ul>
            <li>Select an indexed Katalon project, then run <strong>Analyze framework</strong>.</li>
            <li>
              Gosi Brain scores duplication, Object Repository health, keywords, waits, assertions, and
              architecture — with prioritized recommendations.
            </li>
            <li>
              <strong>Read-only:</strong> nothing is changed in your project; apply fixes manually in Katalon
              Studio.
            </li>
            <li>Use <strong>Force refresh</strong> after re-uploading or re-indexing the project.</li>
          </ul>
          <p className="page-info-hint">
            Tip: use <strong>?</strong> Help → Gosi Brain Refactoring Assistant for the full step-by-step guide.
          </p>
        </PageInfoGuide>

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
