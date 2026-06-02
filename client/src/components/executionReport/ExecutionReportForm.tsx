import type { ExecutionFormState, FailureRowState } from "./executionReportFormState";
import { EMPTY_FAILURE_ROW } from "./executionReportFormState";

const ENV_OPTIONS = ["QA", "Staging", "Prod-like", "UAT", "Development"];
const TYPE_OPTIONS = ["UI", "API", "ASSERTION", "TIMEOUT", "DATA"] as const;
const SEVERITY_OPTIONS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

interface Props {
  form: ExecutionFormState;
  onChange: (next: ExecutionFormState) => void;
  disabled?: boolean;
}

export function ExecutionReportForm({ form, onChange, disabled }: Props) {
  const set = (patch: Partial<ExecutionFormState>) => onChange({ ...form, ...patch });

  const updateRow = (id: string, patch: Partial<FailureRowState>) => {
    set({
      failureRows: form.failureRows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const removeRow = (id: string) => {
    set({ failureRows: form.failureRows.filter((r) => r.id !== id) });
  };

  const addRow = () => {
    set({ failureRows: [...form.failureRows, EMPTY_FAILURE_ROW()] });
  };

  return (
    <div className="er-form">
      <fieldset className="er-fieldset" disabled={disabled}>
        <legend>Basic execution</legend>
        <div className="er-form-grid">
          <label>
            Project name
            <input
              type="text"
              value={form.projectName}
              onChange={(e) => set({ projectName: e.target.value })}
              placeholder="Katalon Automation Suite"
            />
          </label>
          <label>
            Build ID
            <input
              type="text"
              value={form.buildId}
              onChange={(e) => set({ buildId: e.target.value })}
              placeholder="BUILD-10291"
            />
          </label>
          <label>
            Execution date
            <input
              type="date"
              value={form.executionDate}
              onChange={(e) => set({ executionDate: e.target.value })}
            />
          </label>
          <label>
            Environment
            <select value={form.environment} onChange={(e) => set({ environment: e.target.value })}>
              <option value="">— Select —</option>
              {ENV_OPTIONS.map((env) => (
                <option key={env} value={env}>
                  {env}
                </option>
              ))}
            </select>
          </label>
          <label>
            Total test cases
            <input
              type="number"
              min={0}
              value={form.totalTestCases}
              onChange={(e) => set({ totalTestCases: e.target.value })}
            />
          </label>
          <label>
            Passed
            <input
              type="number"
              min={0}
              value={form.passed}
              onChange={(e) => set({ passed: e.target.value })}
            />
          </label>
          <label>
            Failed
            <input
              type="number"
              min={0}
              value={form.failed}
              onChange={(e) => set({ failed: e.target.value })}
            />
          </label>
          <label>
            Skipped
            <input
              type="number"
              min={0}
              value={form.skipped}
              onChange={(e) => set({ skipped: e.target.value })}
            />
          </label>
          <label>
            Execution duration
            <input
              type="text"
              value={form.duration}
              onChange={(e) => set({ duration: e.target.value })}
              placeholder="18m 32s"
            />
          </label>
          <label>
            Pipeline (optional)
            <input
              type="text"
              value={form.pipelineName}
              onChange={(e) => set({ pipelineName: e.target.value })}
              placeholder="nightly-regression"
            />
          </label>
          <label>
            Branch (optional)
            <input
              type="text"
              value={form.branch}
              onChange={(e) => set({ branch: e.target.value })}
              placeholder="main"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="er-fieldset" disabled={disabled}>
        <div className="er-failures-header">
          <legend>Failure details</legend>
          <button type="button" className="er-btn er-btn-secondary" onClick={addRow}>
            + Add failure row
          </button>
        </div>

        {form.failureRows.length === 0 ? (
          <p className="er-form-hint">
            Add rows for bugs found in this execution. Leave empty if the run had zero failures.
          </p>
        ) : (
          <div className="er-failures-table-wrap">
            <table className="er-failures-table">
              <thead>
                <tr>
                  <th>Bug name</th>
                  <th>Jira ID</th>
                  <th>Module</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {form.failureRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="text"
                        value={row.bugName}
                        onChange={(e) => updateRow(row.id, { bugName: e.target.value })}
                        placeholder="Login fails when username has spaces"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.jiraId}
                        onChange={(e) => updateRow(row.id, { jiraId: e.target.value })}
                        placeholder="AUTH-1234"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={row.module}
                        onChange={(e) => updateRow(row.id, { module: e.target.value })}
                        placeholder="Authentication"
                      />
                    </td>
                    <td>
                      <select
                        value={row.failureType}
                        onChange={(e) =>
                          updateRow(row.id, {
                            failureType: e.target.value as FailureRowState["failureType"],
                          })
                        }
                      >
                        {TYPE_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.failureSeverity}
                        onChange={(e) =>
                          updateRow(row.id, {
                            failureSeverity: e.target.value as FailureRowState["failureSeverity"],
                          })
                        }
                        className={`er-sev er-sev-${row.failureSeverity.toLowerCase()}`}
                      >
                        {SEVERITY_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="er-btn-icon"
                        onClick={() => removeRow(row.id)}
                        title="Remove row"
                        aria-label="Remove failure row"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </fieldset>
    </div>
  );
}
