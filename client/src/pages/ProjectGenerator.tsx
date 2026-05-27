import { useEffect, useMemo, useState } from "react";
import {
  analyzeProjectGenerator,
  generateProjectGenerator,
  listKatalonProjects,
  type ArchitecturePattern,
  type DomainHint,
  type FrameworkKind,
  type ProjectGenerationMode,
  type ProjectGeneratorAnalyzeResult,
  type ProjectGeneratorGenerateResult,
  type ProjectMeta,
  type ProjectSize,
} from "../api";
import { PageInfoGuide } from "../components/PageInfoGuide";
import { useLayoutContext } from "../components/layout/LayoutContext";
import { DependencyGraphPreview } from "../components/projectGenerator/DependencyGraphPreview";
import "../components/projectGenerator/projectGenerator.css";

const FRAMEWORK_KINDS: { id: FrameworkKind; label: string }[] = [
  { id: "ui", label: "UI" },
  { id: "api", label: "API" },
  { id: "mobile", label: "Mobile" },
  { id: "performance", label: "Performance" },
  { id: "hybrid", label: "Hybrid (UI + API + optional Mobile/Perf)" },
];

const ARCH_PATTERNS: { id: ArchitecturePattern; label: string }[] = [
  { id: "layered", label: "Layered enterprise" },
  { id: "page-object", label: "Page Object Model" },
  { id: "keyword-driven", label: "Keyword-driven" },
  { id: "hybrid", label: "Hybrid (POM + keywords + services)" },
  { id: "data-driven", label: "Data-driven" },
  { id: "bdd", label: "BDD (Cucumber)" },
  { id: "microservice-api", label: "Microservice API" },
];

const DOMAINS: { id: DomainHint; label: string }[] = [
  { id: "generic", label: "Generic" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "banking", label: "Banking" },
  { id: "healthcare", label: "Healthcare" },
  { id: "saas", label: "SaaS" },
  { id: "government", label: "Government" },
];

const PROJECT_SIZES: { id: ProjectSize; label: string }[] = [
  { id: "starter", label: "Starter" },
  { id: "standard", label: "Standard" },
  { id: "enterprise", label: "Enterprise" },
];

const REUSE_MODES: { id: ProjectGenerationMode; label: string }[] = [
  { id: "strict_reuse", label: "Strict reuse" },
  { id: "balanced", label: "Balanced reuse" },
  { id: "generate_everything", label: "Generate everything" },
];

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 50);
}

export default function ProjectGenerator() {
  const { embedded } = useLayoutContext();
  const [projects, setProjects] = useState<ProjectMeta[]>([]);

  const [projectName, setProjectName] = useState("EnterpriseKatalonProject");
  const [description, setDescription] = useState(
    "Generate an enterprise automation framework for an e-commerce app with login, search, and checkout."
  );
  const [frameworkKind, setFrameworkKind] = useState<FrameworkKind>("hybrid");
  const [architecturePattern, setArchitecturePattern] = useState<ArchitecturePattern>("layered");
  const [domain, setDomain] = useState<DomainHint>("ecommerce");
  const [projectSize, setProjectSize] = useState<ProjectSize>("standard");
  const [reuseMode, setReuseMode] = useState<ProjectGenerationMode>("balanced");
  const [sourceProjectId, setSourceProjectId] = useState("");

  const [modulesText, setModulesText] = useState("Auth\nCatalog\nCheckout\nAPI\nReporting");
  const [flowsText, setFlowsText] = useState("Login → Search → Add to Cart → Checkout");

  const [includeReporting, setIncludeReporting] = useState(true);
  const [includeBdd, setIncludeBdd] = useState(false);
  const [includeMobile, setIncludeMobile] = useState(false);
  const [includePerformance, setIncludePerformance] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ProjectGeneratorAnalyzeResult | null>(null);
  const [result, setResult] = useState<ProjectGeneratorGenerateResult | null>(null);

  useEffect(() => {
    document.title = "AI Project Generator — Katalon Script Generator";
    listKatalonProjects()
      .then((list) => {
        setProjects(list);
        if (list[0] && !sourceProjectId) setSourceProjectId(list[0].projectId);
      })
      .catch(() => setProjects([]));
    return () => {
      document.title = "Katalon Script Generator";
    };
  }, []);

  const payload = useMemo(
    () => ({
      projectName,
      description,
      frameworkKind,
      architecturePattern,
      domain,
      projectSize,
      reuseMode,
      sourceProjectId: sourceProjectId || undefined,
      modules: splitLines(modulesText),
      businessFlows: splitLines(flowsText),
      includeReporting,
      includeBdd,
      includeMobile,
      includePerformance,
      inputSources: ["description"],
    }),
    [
      projectName,
      description,
      frameworkKind,
      architecturePattern,
      domain,
      projectSize,
      reuseMode,
      sourceProjectId,
      modulesText,
      flowsText,
      includeReporting,
      includeBdd,
      includeMobile,
      includePerformance,
    ]
  );

  const runAnalyze = async () => {
    setLoading(true);
    setError(null);
    setAnalysis(null);
    try {
      const data = await analyzeProjectGenerator(payload);
      setAnalysis(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analyze failed");
    } finally {
      setLoading(false);
    }
  };

  const runGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await generateProjectGenerator(payload);
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={embedded ? "pg-root pg-root--embedded" : "pg-root"}>
      {!embedded && (
        <header className="pg-header">
          <div>
            <h1>AI Katalon Project Generator</h1>
            <p>Generate full enterprise Katalon projects (OR, pages, keywords, suites, docs, health)</p>
          </div>
        </header>
      )}

      <main className="pg-main">
        <PageInfoGuide title="How this works">
          <ul>
            <li>Describe your system and choose framework style, domain, and reuse mode.</li>
            <li>
              Use <strong>Analyze</strong> to preview inferred modules/flows and estimated scope.
            </li>
            <li>
              Use <strong>Generate</strong> to build the full project structure and download a zip.
            </li>
            <li>
              <strong>Safe:</strong> this does not overwrite uploaded projects; it generates a new package.
            </li>
          </ul>
        </PageInfoGuide>

        <div className="pg-toolbar">
          <label>
            Project name
            <input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
          </label>

          <label>
            Framework type
            <select value={frameworkKind} onChange={(e) => setFrameworkKind(e.target.value as FrameworkKind)}>
              {FRAMEWORK_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Architecture pattern
            <select
              value={architecturePattern}
              onChange={(e) => setArchitecturePattern(e.target.value as ArchitecturePattern)}
            >
              {ARCH_PATTERNS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Domain
            <select value={domain} onChange={(e) => setDomain(e.target.value as DomainHint)}>
              {DOMAINS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Project size
            <select value={projectSize} onChange={(e) => setProjectSize(e.target.value as ProjectSize)}>
              {PROJECT_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Reuse mode
            <select value={reuseMode} onChange={(e) => setReuseMode(e.target.value as ProjectGenerationMode)}>
              {REUSE_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ gridColumn: "1 / -1" }}>
            Description
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the application, modules, and desired automation outcomes…"
            />
          </label>

          <label>
            Reuse from project (optional)
            <select value={sourceProjectId} onChange={(e) => setSourceProjectId(e.target.value)}>
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.projectName || p.projectId}
                </option>
              ))}
            </select>
          </label>

          <label>
            Modules (one per line)
            <textarea rows={3} value={modulesText} onChange={(e) => setModulesText(e.target.value)} />
          </label>

          <label>
            Business flows (one per line)
            <textarea rows={3} value={flowsText} onChange={(e) => setFlowsText(e.target.value)} />
          </label>

          <label>
            Include reporting
            <select value={includeReporting ? "yes" : "no"} onChange={(e) => setIncludeReporting(e.target.value === "yes")}>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </label>

          <label>
            Include BDD
            <select value={includeBdd ? "yes" : "no"} onChange={(e) => setIncludeBdd(e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>

          <label>
            Include Mobile
            <select value={includeMobile ? "yes" : "no"} onChange={(e) => setIncludeMobile(e.target.value === "yes")}>
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>

          <label>
            Include Performance
            <select
              value={includePerformance ? "yes" : "no"}
              onChange={(e) => setIncludePerformance(e.target.value === "yes")}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
        </div>

        <div className="pg-actions">
          <button type="button" className="pg-btn" disabled={loading} onClick={runAnalyze}>
            {loading ? "Working…" : "Analyze"}
          </button>
          <button type="button" className="pg-btn pg-btn-primary" disabled={loading} onClick={runGenerate}>
            {loading ? "Working…" : "Generate project"}
          </button>
          {result?.downloadableZip && (
            <a className="pg-btn" href={result.downloadableZip}>
              Download zip
            </a>
          )}
        </div>

        {error && <p className="pg-error">{error}</p>}

        <div className="pg-grid-2">
          <section className="pg-panel">
            <h2>Architecture preview</h2>
            <div className="pg-panel-body">
              {analysis ? (
                <>
                  <div className="pg-kv">
                    <strong>Generation ID</strong>
                    <span>{analysis.generationId}</span>
                    <strong>Summary</strong>
                    <span>{analysis.architectureSummary}</span>
                    <strong>Estimated scope</strong>
                    <span>{analysis.estimatedFileCount} files</span>
                  </div>

                  <h3 style={{ margin: "0.75rem 0 0.25rem", fontSize: "0.9rem" }}>Inferred modules</h3>
                  <ul className="pg-list">
                    {analysis.inferredModules.slice(0, 16).map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>

                  <h3 style={{ margin: "0.75rem 0 0.25rem", fontSize: "0.9rem" }}>Inferred flows</h3>
                  <ul className="pg-list">
                    {analysis.inferredFlows.slice(0, 10).map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="pg-empty">Run Analyze to preview the architecture plan.</p>
              )}
            </div>
          </section>

          <section className="pg-panel">
            <h2>Generated structure & health</h2>
            <div className="pg-panel-body">
              {result ? (
                <>
                  <div className="pg-kv">
                    <strong>Health score</strong>
                    <span>{result.healthScore}</span>
                    <strong>OR quality</strong>
                    <span>{result.frameworkHealth.orQuality}</span>
                    <strong>Modularity</strong>
                    <span>{result.frameworkHealth.modularityScore}</span>
                    <strong>Warnings</strong>
                    <span>{result.warnings.length}</span>
                  </div>

                  <h3 style={{ margin: "0.75rem 0 0.25rem", fontSize: "0.9rem" }}>Dependency graph</h3>
                  <DependencyGraphPreview graph={result.dependencyGraph} />

                  <h3 style={{ margin: "0.75rem 0 0.25rem", fontSize: "0.9rem" }}>Structure preview</h3>
                  <div className="pg-structure">
                    {result.structurePreview.slice(0, 60).join("\n")}
                  </div>
                </>
              ) : (
                <p className="pg-empty">Run Generate to create the project and preview its structure.</p>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

