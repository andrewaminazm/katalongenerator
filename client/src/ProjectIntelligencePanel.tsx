import { useCallback, useEffect, useState } from "react";
import {
  fetchKatalonProject,
  listKatalonProjects,
  uploadKatalonProjectZip,
  type ProjectGenerationMode,
  type ProjectMeta,
} from "./api";
import { FieldBlock, TipIcon } from "./FieldTip";
import { TIPS } from "./fieldTips";

type Props = {
  activeProjectId: string;
  generationMode: ProjectGenerationMode;
  onActiveProjectId: (id: string) => void;
  onGenerationMode: (mode: ProjectGenerationMode) => void;
};

export function ProjectIntelligencePanel({
  activeProjectId,
  generationMode,
  onActiveProjectId,
  onGenerationMode,
}: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explorerTab, setExplorerTab] = useState<"or" | "keywords" | "scripts" | "flows">("or");
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof fetchKatalonProject>> | null>(null);
  const [search, setSearch] = useState("");

  const refreshList = useCallback(async () => {
    try {
      const list = await listKatalonProjects();
      setProjects(list);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!activeProjectId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    fetchKatalonProject(activeProjectId)
      .then((p) => {
        if (!cancelled) setDetail(p);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeProjectId]);

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const p = await uploadKatalonProjectZip(
        file,
        file.name.replace(/\.(zip|rar)$/i, "")
      );
      await refreshList();
      onActiveProjectId(p.projectId);
      setDetail(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  const filteredOr =
    detail?.testObjects?.filter((o) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        o.label.toLowerCase().includes(q) ||
        o.path.toLowerCase().includes(q)
      );
    }) ?? [];

  const filteredKw =
    detail?.keywords?.filter((k) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        k.className.toLowerCase().includes(q) ||
        k.customKeywordsPath.toLowerCase().includes(q)
      );
    }) ?? [];

  const scripts = detail?.testScripts ?? [];
  const filteredScripts = scripts.filter((s) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      s.logicalPath.toLowerCase().includes(q) ||
      s.displayName.toLowerCase().includes(q) ||
      s.kind.toLowerCase().includes(q)
    );
  });

  return (
    <div className="mobile-panel" style={{ marginTop: "1rem" }}>
      <h3 style={{ margin: "0 0 0.5rem" }}>Katalon project intelligence</h3>
      <p className="hint" style={{ margin: "0 0 0.5rem" }}>
        Open <strong>?</strong> in the header → <strong>Project intelligence</strong> for the full guide.
      </p>
      <p className="hint" style={{ margin: "0 0 0.75rem" }}>
        Upload a full Katalon Studio <strong>.zip</strong> or <strong>.rar</strong> archive to index
        Object Repository, Keywords, and <strong>test scripts</strong> (Scripts/, Test Cases/, Include/).
        Generation reuses matching assets when an active project is selected.
      </p>

      <div className="field-block" style={{ marginBottom: "0.5rem" }}>
        <div className="field-label-row">
          <span className="field-label">Upload project archive</span>
          <TipIcon tip={TIPS.projectUpload} />
        </div>
        <div className="row-actions">
          <label className="btn btn-ghost" style={{ cursor: "pointer" }}>
            {loading ? "Indexing…" : "Upload Katalon project (.zip or .rar)"}
            <input
              type="file"
              accept=".zip,.rar,application/zip,application/vnd.rar,application/x-rar-compressed"
              className="file-input-sr-only"
              disabled={loading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                void onUpload(f ?? null);
                e.target.value = "";
              }}
            />
          </label>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => void refreshList()}>
            Refresh list
          </button>
        </div>
      </div>

      <div className="row-2" style={{ marginBottom: "0.5rem" }}>
        <FieldBlock tip={TIPS.activeProject} label="Active project" htmlFor="activeProject">
          <select
            id="activeProject"
            className="input"
            value={activeProjectId}
            onChange={(e) => onActiveProjectId(e.target.value)}
          >
            <option value="">— None (no project reuse) —</option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectName} ({p.stats.testObjects} OR, {p.stats.keywordMethods} kw,{" "}
                {p.stats.testScripts ?? p.stats.testCases ?? 0} scripts)
              </option>
            ))}
          </select>
        </FieldBlock>
        <FieldBlock tip={TIPS.generationMode} label="Generation mode" htmlFor="genMode">
          <select
            id="genMode"
            className="input"
            value={generationMode}
            onChange={(e) => onGenerationMode(e.target.value as ProjectGenerationMode)}
          >
            <option value="strict_reuse">Strict reuse</option>
            <option value="balanced">Balanced</option>
            <option value="generate_everything">Generate everything (hints only)</option>
          </select>
        </FieldBlock>
      </div>

      {error && <p className="status-msg error">{error}</p>}

      {detail && (
        <>
          <p className="katalon-loaded-summary">
            Indexed: {detail.stats.testObjects} test objects · {detail.stats.keywordMethods} keyword
            methods · {detail.stats.testScripts ?? detail.stats.testCases ?? 0} test scripts
            {detail.stats.parseErrors > 0 ? ` · ${detail.stats.parseErrors} parse skips` : ""}
          </p>

          <FieldBlock
            tip="Filter indexed Object Repository, Keywords, and test scripts in this project."
            label="Search project index"
            htmlFor="projectSearch"
          >
            <input
              id="projectSearch"
              className="input"
              placeholder="Search objects, keywords, or scripts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </FieldBlock>

          <div className="tabs" role="tablist">
            <button
              type="button"
              className={`tab ${explorerTab === "or" ? "active" : ""}`}
              onClick={() => setExplorerTab("or")}
            >
              Object Repository ({filteredOr.length})
            </button>
            <button
              type="button"
              className={`tab ${explorerTab === "keywords" ? "active" : ""}`}
              onClick={() => setExplorerTab("keywords")}
            >
              Keywords ({filteredKw.length})
            </button>
            <button
              type="button"
              className={`tab ${explorerTab === "scripts" ? "active" : ""}`}
              onClick={() => setExplorerTab("scripts")}
            >
              Test scripts ({filteredScripts.length})
            </button>
            <button
              type="button"
              className={`tab ${explorerTab === "flows" ? "active" : ""}`}
              onClick={() => setExplorerTab("flows")}
            >
              Reusable flows ({detail.reusableFlows?.length ?? 0})
            </button>
          </div>

          <div
            className="loc-convert-report"
            style={{ maxHeight: 220, marginTop: "0.5rem" }}
          >
            {explorerTab === "or" && (
              <table>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Path</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOr.slice(0, 80).map((o) => (
                    <tr key={o.path}>
                      <td>{o.label}</td>
                      <td className="loc-convert-code">{o.path}</td>
                      <td>{o.selectorType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {explorerTab === "scripts" && (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Path</th>
                    <th>Kind</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScripts.slice(0, 80).map((s) => (
                    <tr key={s.scriptPath}>
                      <td>{s.displayName}</td>
                      <td className="loc-convert-code">{s.logicalPath}</td>
                      <td>{s.kind}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {explorerTab === "keywords" &&
              filteredKw.slice(0, 40).map((k) => (
                <div key={k.customKeywordsPath} style={{ padding: "0.35rem 0.5rem" }}>
                  <strong>{k.className}</strong>
                  <div className="hint">{k.customKeywordsPath}</div>
                  <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem" }}>
                    {k.methods.slice(0, 8).map((m) => (
                      <li key={m.name}>
                        <code className="loc-convert-code">{m.signature}</code>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            {explorerTab === "flows" &&
              (detail.reusableFlows?.length ? (
                detail.reusableFlows.map((f) => (
                  <div key={f.id} style={{ padding: "0.35rem 0.5rem" }}>
                    <strong>{f.name}</strong>
                    <p className="hint" style={{ margin: 0 }}>
                      {f.description}
                    </p>
                  </div>
                ))
              ) : (
                <p className="hint" style={{ padding: "0.5rem" }}>
                  No reusable flows detected yet.
                </p>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
