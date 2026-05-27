import { useEffect, useState } from "react";
import {
  analyzeProjectRepair,
  executeProjectRepair,
  listKatalonProjects,
  previewProjectRepair,
  type ProjectMeta,
  type ProjectRepairResult,
} from "../api";

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
import { PageInfoGuide } from "../components/PageInfoGuide";
import { useLayoutContext } from "../components/layout/LayoutContext";
import { RepairDashboard } from "../components/projectRepair/RepairDashboard";
import "../components/projectRepair/projectRepair.css";

export default function ProjectRepair() {
  const { embedded } = useLayoutContext();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [projectId, setProjectId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectRepairResult | null>(null);

  useEffect(() => {
    document.title = "AI Project Repair Engine — Katalon Script Generator";
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

  const runAnalyze = async (forceRefresh = false) => {
    if (!projectId) {
      setError("Select a project");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await analyzeProjectRepair({ projectId, forceRefresh });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const runPreview = async () => {
    if (!result?.repairId || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await previewProjectRepair({
        projectId,
        repairId: result.repairId,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  };

  const runRepair = async () => {
    if (!result?.repairId || !projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await executeProjectRepair({
        projectId,
        repairId: result.repairId,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Repair failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={embedded ? "pr-root pr-root--embedded" : "pr-root"}>
      {!embedded && (
        <header className="pr-header">
          <div>
            <h1>AI Project Repair Engine</h1>
            <p>
              Enterprise framework recovery — scripts, locators, waits, architecture (preview + safe repair,
              never overwrites uploads)
            </p>
          </div>
        </header>
      )}

      <main className="pr-main">
        <PageInfoGuide title="How this works">
          <ul>
            <li>Select an indexed project and run <strong>Analyze project</strong>.</li>
            <li>Review health scores, repair suggestions, locator repairs, and risk areas.</li>
            <li>
              <strong>Preview repairs</strong> shows diffs for auto-applicable fixes (Thread.sleep, imports,
              OR remap).
            </li>
            <li>
              <strong>Apply safe repairs</strong> builds a downloadable zip with patched scripts (original
              project + auto-fixes). Import into Katalon Studio — your server upload is never overwritten.
            </li>
          </ul>
        </PageInfoGuide>

        <div className="pr-toolbar">
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
            className="pr-btn pr-btn-primary"
            disabled={loading || !projectId}
            onClick={() => runAnalyze(false)}
          >
            {loading ? "Working…" : "Analyze project"}
          </button>
          <button
            type="button"
            className="pr-btn"
            disabled={loading || !projectId}
            onClick={() => runAnalyze(true)}
          >
            Force refresh
          </button>
          <button
            type="button"
            className="pr-btn"
            disabled={loading || !result?.repairId}
            onClick={runPreview}
          >
            Preview repairs
          </button>
          <button
            type="button"
            className="pr-btn"
            disabled={loading || !result?.repairId}
            onClick={runRepair}
          >
            Apply safe repairs
          </button>
          {result?.downloadableZip && (
            <a
              className="pr-btn pr-btn-primary"
              href={`${API_BASE}${result.downloadableZip}`}
              download
            >
              Download repaired project (.zip)
            </a>
          )}
        </div>

        {error && <p className="pr-error">{error}</p>}

        {result && <RepairDashboard result={result} />}
      </main>
    </div>
  );
}
