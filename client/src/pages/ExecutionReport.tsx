import { useCallback, useEffect, useState } from "react";
import {
  downloadExecutionReportPdf,
  fetchExecutionReportSample,
  generateExecutionReport,
  type ExecutionReportOutput,
} from "../api";
import { ExecutionReportForm } from "../components/executionReport/ExecutionReportForm";
import { ExecutionReportPreview } from "../components/executionReport/ExecutionReportPreview";
import { ExecutionReportTypeTabs } from "../components/executionReport/ExecutionReportTypeTabs";
import type { ExecutionReportViewType } from "../components/executionReport/executionReportTypes";
import {
  EXECUTION_REPORT_TYPES,
  getReportTypeOption,
  reportTypePdfFilename,
} from "../components/executionReport/executionReportTypes";
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
  const [reportType, setReportType] = useState<ExecutionReportViewType>("execution");
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
      const input = buildInputFromForm(form, reportType);
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
      const input = buildInputFromForm(form, reportType);
      const blob = await downloadExecutionReportPdf(input);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = reportTypePdfFilename(input.projectName, input.buildId, reportType);
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
            Choose a <strong>report type</strong> tab (11 formats: execution, severity, modules, flaky, executive,
            and more), then <strong>Generate report</strong> — switch tabs anytime after generation to change the
            view.
          </li>
          <li>
            <strong>Download PDF</strong> exports a professional A4 document matching the{" "}
            <strong>selected report type</strong> tab (cover page, KPIs, charts, and type-specific sections).
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
          Download PDF ({EXECUTION_REPORT_TYPES.find((t) => t.id === reportType)?.shortLabel ?? "Report"})
        </button>
      </div>

      {error && <p className="er-error">{error}</p>}

      <div className="er-layout er-layout--form">
        <section className="er-panel er-panel--form">
          <h2>Execution input</h2>
          <ExecutionReportForm form={form} onChange={setForm} disabled={loading} />
        </section>

        <section className="er-panel er-panel--preview">
          <div className="er-preview-header">
            <h2>
              {EXECUTION_REPORT_TYPES.find((t) => t.id === reportType)?.label ?? "Report"} preview
            </h2>
            <ExecutionReportTypeTabs value={reportType} onChange={setReportType} disabled={loading} />
          </div>
          {!report && !loading && (
            <p className="er-form-hint">
              {getReportTypeOption(reportType)?.description ??
                "Select a report type, complete the form, and generate."}
            </p>
          )}
          {loading && (
            <p className="er-form-hint">
              Generating{" "}
              {EXECUTION_REPORT_TYPES.find((t) => t.id === reportType)?.shortLabel.toLowerCase()} report…
            </p>
          )}
          {report && <ExecutionReportPreview report={report} reportType={reportType} />}
        </section>
      </div>
    </div>
  );
}
