import { useCallback, useEffect, useState } from "react";
import {
  analyzeProjectIntelligenceV2,
  downloadProjectDocumentationPdf,
  fetchKatalonProject,
  fixProjectScript,
  healProjectLocator,
  listKatalonProjects,
  uploadKatalonProjectZip,
  type LocatorHealItemResult,
  type ProjectGenerationMode,
  type ProjectIntelligenceV2Result,
  type ProjectMeta,
  type ScriptFixItemResult,
} from "./api";
import { ItemFixPanel } from "./components/ProjectIntelligence/ItemFixPanel";
import { ActionWithTip, FieldBlock, TabWithTip, TipIcon } from "./FieldTip";
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
  const [v2Loading, setV2Loading] = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [v2Result, setV2Result] = useState<ProjectIntelligenceV2Result | null>(null);
  const [itemLoading, setItemLoading] = useState(false);
  const [scriptFix, setScriptFix] = useState<ScriptFixItemResult | null>(null);
  const [locatorHeal, setLocatorHeal] = useState<LocatorHealItemResult | null>(null);
  const [selectedScriptPath, setSelectedScriptPath] = useState<string | null>(null);
  const [selectedOrPath, setSelectedOrPath] = useState<string | null>(null);
  const [healPageUrl, setHealPageUrl] = useState("");

  const onScriptClick = async (scriptPath: string) => {
    if (!activeProjectId) return;
    setSelectedScriptPath(scriptPath);
    setSelectedOrPath(null);
    setLocatorHeal(null);
    setItemLoading(true);
    setError(null);
    try {
      const r = await fixProjectScript(activeProjectId, scriptPath);
      setScriptFix(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Script fix failed");
      setScriptFix(null);
    } finally {
      setItemLoading(false);
    }
  };

  const onLocatorClick = async (orPath: string, pageUrl?: string) => {
    if (!activeProjectId) return;
    setSelectedOrPath(orPath);
    setSelectedScriptPath(null);
    setScriptFix(null);
    setItemLoading(true);
    setError(null);
    try {
      const r = await healProjectLocator(activeProjectId, orPath, pageUrl ?? healPageUrl);
      setLocatorHeal(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Locator healing failed");
      setLocatorHeal(null);
    } finally {
      setItemLoading(false);
    }
  };

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
        Generation reuses matching assets when an active project is selected. Click a{" "}
        <strong>test script</strong> to regenerate/fix its Groovy, or an <strong>Object Repository</strong> row to
        get the best locator.
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

      {activeProjectId && (
        <div className="row-actions" style={{ marginBottom: "0.75rem" }}>
          <ActionWithTip
            tip={TIPS.projectAnalyze}
            tipPlacement="above"
            disabled={v2Loading}
            onClick={async () => {
              setV2Loading(true);
              setError(null);
              try {
                const r = await analyzeProjectIntelligenceV2(activeProjectId);
                setV2Result(r);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Analysis failed");
                setV2Result(null);
              } finally {
                setV2Loading(false);
              }
            }}
          >
            {v2Loading ? "Analyzing…" : "Project Analyze"}
          </ActionWithTip>
          {v2Result?.documentation?.markdown && (
            <button
              type="button"
              className="btn btn-ghost btn-small"
              disabled={pdfDownloading}
              onClick={async () => {
                if (!activeProjectId || pdfDownloading) return;
                setPdfDownloading(true);
                setError(null);
                try {
                  const blob = await downloadProjectDocumentationPdf(activeProjectId, {
                    markdown: v2Result.documentation.markdown,
                    projectName: v2Result.projectName,
                    title: `${v2Result.projectName} — Project documentation`,
                  });
                  const a = document.createElement("a");
                  const url = URL.createObjectURL(blob);
                  a.href = url;
                  a.download = `${v2Result.projectName.replace(/\s+/g, "_")}-docs.pdf`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "PDF download failed");
                } finally {
                  setPdfDownloading(false);
                }
              }}
            >
              {pdfDownloading ? "Generating PDF…" : "Download docs (PDF)"}
            </button>
          )}
        </div>
      )}

      {v2Result && (
        <div className="status-banner" style={{ marginBottom: "0.75rem" }}>
          <strong>v2 analysis</strong> — risk {v2Result.insights.riskScore}/100 ·{" "}
          {v2Result.fixes.testCases.filter((t) => t.changed).length} script fix(es) ·{" "}
          {v2Result.fixes.objectRepository.length} OR proposal(s) ·{" "}
          {v2Result.insights.flakyTests.length} flaky flag(s)
          {v2Result.warnings.length > 0 && (
            <p className="hint" style={{ margin: "0.35rem 0 0" }}>
              {v2Result.warnings.join(" · ")}
            </p>
          )}
        </div>
      )}

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
            <TabWithTip
              tip={TIPS.projectExplorerOr}
              active={explorerTab === "or"}
              onClick={() => setExplorerTab("or")}
            >
              Object Repository ({filteredOr.length})
            </TabWithTip>
            <TabWithTip
              tip={TIPS.projectExplorerKeywords}
              active={explorerTab === "keywords"}
              onClick={() => setExplorerTab("keywords")}
            >
              Keywords ({filteredKw.length})
            </TabWithTip>
            <TabWithTip
              tip={TIPS.projectExplorerScripts}
              active={explorerTab === "scripts"}
              onClick={() => setExplorerTab("scripts")}
            >
              Test scripts ({filteredScripts.length})
            </TabWithTip>
            <TabWithTip
              tip={TIPS.projectExplorerFlows}
              active={explorerTab === "flows"}
              onClick={() => setExplorerTab("flows")}
            >
              Reusable flows ({detail.reusableFlows?.length ?? 0})
            </TabWithTip>
          </div>

          <div
            className="loc-convert-report pi-explorer-table"
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
                    <tr
                      key={o.path}
                      className={`pi-explorer-row${selectedOrPath === o.path ? " pi-explorer-row--active" : ""}`}
                      title="Click to heal locator"
                      onClick={() => void onLocatorClick(o.path)}
                    >
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
                    <tr
                      key={s.scriptPath}
                      className={`pi-explorer-row${selectedScriptPath === s.scriptPath ? " pi-explorer-row--active" : ""}`}
                      title="Click to fix / regenerate script"
                      onClick={() => void onScriptClick(s.scriptPath)}
                    >
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

          {(selectedScriptPath || selectedOrPath) && (
            <ItemFixPanel
              {...(selectedScriptPath
                ? {
                    kind: "script" as const,
                    loading: itemLoading,
                    result: scriptFix,
                    onClose: () => {
                      setSelectedScriptPath(null);
                      setScriptFix(null);
                    },
                  }
                : {
                    kind: "locator" as const,
                    loading: itemLoading,
                    result: locatorHeal,
                    pageUrl: healPageUrl,
                    onPageUrlChange: setHealPageUrl,
                    onRetryWithUrl: () => {
                      if (selectedOrPath) void onLocatorClick(selectedOrPath, healPageUrl);
                    },
                    onClose: () => {
                      setSelectedOrPath(null);
                      setLocatorHeal(null);
                    },
                  })}
            />
          )}
        </>
      )}
    </div>
  );
}
