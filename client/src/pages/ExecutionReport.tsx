import { useCallback, useEffect, useState } from "react";
import {
  downloadExecutionReportPdf,
  fetchExecutionReportSample,
  generateExecutionReport,
  type ExecutionReportOutput,
} from "../api";
import { ExecutionReportForm } from "../components/executionReport/ExecutionReportForm";
import { ExecutionReportPreview } from "../components/executionReport/ExecutionReportPreview";
import {
  buildInputFromForm,
  DEFAULT_FORM_STATE,
  formStateFromSample,
  type ExecutionFormState,
} from "../components/executionReport/executionReportFormState";
import { useLayoutContext } from "../components/layout/LayoutContext";
import { PageInfoGuide } from "../components/PageInfoGuide";
import "../components/executionReport/executionReport.css";

export default function ExecutionReport() {
  const { embedded } = useLayoutContext();
  const [form, setForm] = useState<ExecutionFormState>(DEFAULT_FORM_STATE);
  const [report, setReport] = useState<ExecutionReportOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSample = useCallback(async () => {
    setError(null);
    setLoadingSample(true);
    try {
      const sample = await fetchExecutionReportSample();
      setForm(formStateFromSample(sample));
      setReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load sample");
    } finally {
      setLoadingSample(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Execution Report — Katalon Script Generator";
    return () => {
      document.title = "Katalon Script Generator";
    };
  }, []);

  const runGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const input = buildInputFromForm(form);
      const result = await generateExecutionReport(input);
      setReport(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const runPdf = async () => {
    setLoading(true);
    setError(null);
    try {
      const input = buildInputFromForm(form);
      const blob = await downloadExecutionReportPdf(input);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${input.projectName.replace(/\s+/g, "_")}_${input.buildId}-execution-report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      const result = await generateExecutionReport(input);
      setReport(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={embedded ? "er-root er-root--embedded" : "er-root"}>
      {!embedded && (
        <header className="er-header">
          <h1>AI Execution Report Generator</h1>
          <p>Enter execution results in the form — get executive PDF intelligence (no JSON required)</p>
        </header>
      )}

      <PageInfoGuide title="How this works">
        <ul>
          <li>
            Enter project, build, pass/fail counts, and optional failure rows — or use{" "}
            <strong>Load sample data</strong> to explore the workflow.
          </li>
          <li>
            <strong>Generate report</strong> returns release readiness, module risk scores, trend charts, and
            executive insights as JSON you can review on screen.
          </li>
          <li>
            <strong>Download PDF</strong> saves the same report as a shareable document.
          </li>
        </ul>
        <p className="page-info-hint">
          Tip: open <strong>Documentation</strong> from the header and search <strong>AI Execution Report Generator</strong>{" "}
          for the full guide (form fields, release scoring, PDF export, and troubleshooting).
        </p>
      </PageInfoGuide>

      <div className="er-toolbar">
        <button
          type="button"
          className="er-btn"
          onClick={() => void loadSample()}
          disabled={loading || loadingSample}
        >
          {loadingSample ? "Loading sample…" : "Load sample data"}
        </button>
        <button type="button" className="er-btn er-btn-primary" onClick={() => void runGenerate()} disabled={loading}>
          {loading ? "Working…" : "Generate report"}
        </button>
        <button type="button" className="er-btn" onClick={() => void runPdf()} disabled={loading}>
          Download PDF
        </button>
      </div>

      {error && <p className="er-error">{error}</p>}

      <div className="er-layout er-layout--form">
        <section className="er-panel er-panel--form">
          <h2>Execution input</h2>
          <ExecutionReportForm form={form} onChange={setForm} disabled={loading} />
        </section>

        <section className="er-panel">
          <h2>Intelligence preview</h2>
          {!report && !loading && (
            <p className="er-form-hint">
              Complete the form and generate a report to see executive summary, release readiness, and
              recommendations.
            </p>
          )}
          {loading && <p className="er-form-hint">Analyzing execution data…</p>}
          {report && <ExecutionReportPreview report={report} />}
        </section>
      </div>
    </div>
  );
}
