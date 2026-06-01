import type { ExecutionReportViewType } from "./executionReportTypes";
import { EXECUTION_REPORT_TYPES } from "./executionReportTypes";

export function ExecutionReportTypeTabs({
  value,
  onChange,
  disabled,
}: {
  value: ExecutionReportViewType;
  onChange: (type: ExecutionReportViewType) => void;
  disabled?: boolean;
}) {
  const active = EXECUTION_REPORT_TYPES.find((t) => t.id === value);

  return (
    <div className="er-report-type-tabs" role="tablist" aria-label="Report type">
      <div className="er-report-type-tablist">
        {EXECUTION_REPORT_TYPES.map((opt) => (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={value === opt.id}
            className={`er-report-type-tab${value === opt.id ? " er-report-type-tab--active" : ""}`}
            onClick={() => onChange(opt.id)}
            disabled={disabled}
          >
            {opt.shortLabel}
          </button>
        ))}
      </div>
      {active && <p className="er-report-type-desc">{active.description}</p>}
    </div>
  );
}
