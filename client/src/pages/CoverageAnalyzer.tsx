import { useEffect, useState } from "react";
import {
  analyzeCoverage,
  listKatalonProjects,
  type CoverageAnalysisResult,
  type ProjectMeta,
} from "../api";
import { CoverageDashboard } from "../components/coverage/CoverageDashboard";
import "../components/coverage/coverage.css";

export default function CoverageAnalyzer() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [projectId, setProjectId] = useState("");
  const [swagger, setSwagger] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoverageAnalysisResult | null>(null);

  useEffect(() => {
    document.title = "Coverage Analyzer — Katalon Script Generator";
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
      const data = await analyzeCoverage({
        projectId,
        swagger: swagger.trim() || undefined,
        forceRefresh,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cov-root">
      <header className="cov-header">
        <div>
          <h1>AI Coverage Analyzer</h1>
          <p>Coverage gaps, risk scoring, OR/keyword health, API and business-flow intelligence</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <a href="/" className="cov-btn cov-btn-primary cov-link">
            ← Generator
          </a>
          <a href="/ai-workspace" className="cov-btn cov-link">
            AI Workspace
          </a>
          <a href="/refactor" className="cov-btn cov-link">
            Refactor
          </a>
          <a href="/how-to-use" className="cov-btn cov-link">
            Documentation
          </a>
        </div>
      </header>

      <main className="cov-main">
        <div className="cov-toolbar">
          <label>
            Project
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">— Select —</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName}
                </option>
              ))}
            </select>
          </label>
          <label>
            OpenAPI / Swagger (optional)
            <textarea
              placeholder="Paste spec for API coverage gaps"
              value={swagger}
              onChange={(e) => setSwagger(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="cov-btn cov-btn-primary"
            disabled={loading || !projectId}
            onClick={() => void run(false)}
          >
            {loading ? "Analyzing…" : "Analyze coverage"}
          </button>
          <button
            type="button"
            className="cov-btn"
            disabled={loading || !projectId}
            onClick={() => void run(true)}
          >
            Force refresh
          </button>
        </div>

        {error && <p className="cov-error">{error}</p>}

        {result && (
          <>
            <p style={{ fontSize: "var(--text-small)", color: "var(--muted)", marginBottom: "1rem" }}>
              {result.projectName} · analyzed {new Date(result.analyzedAt).toLocaleString()}
              {result.fromCache ? " · cached" : ""}
            </p>
            <CoverageDashboard result={result} />
          </>
        )}

        {!result && !loading && !error && (
          <p className="cov-empty">
            Upload and index a Katalon project on the generator, then run coverage analysis here.
            Results are cached until the project index changes or you force refresh.
          </p>
        )}
      </main>
    </div>
  );
}
