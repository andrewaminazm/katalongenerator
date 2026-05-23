import { FieldBlock } from "../../FieldTip";

const T_PRIMARY =
  "Paste Katalon Studio execution log (.log) or report output — primary input; stacktrace and screenshot are optional.";
const T_OPTIONAL = "Optional — adds extra confidence; not required for analysis.";

export interface FailureInputState {
  logs: string;
  stacktrace: string;
  consoleLogs: string;
  apiResponse: string;
  harLog: string;
  katalonReport: string;
  appiumLog: string;
  screenshotDescription: string;
  testName: string;
  failedStep: string;
}

export const EMPTY_FAILURE_INPUT: FailureInputState = {
  logs: "",
  stacktrace: "",
  consoleLogs: "",
  apiResponse: "",
  harLog: "",
  katalonReport: "",
  appiumLog: "",
  screenshotDescription: "",
  testName: "",
  failedStep: "",
};

export function LogUploadPanel({
  values,
  onChange,
  onScreenshotFile,
  screenshotPreview,
}: {
  values: FailureInputState;
  onChange: (patch: Partial<FailureInputState>) => void;
  onScreenshotFile: (file: File | null) => void;
  screenshotPreview: string | null;
}) {
  const hasPrimaryLog =
    Boolean(values.logs.trim()) ||
    Boolean(values.katalonReport.trim()) ||
    Boolean(values.appiumLog.trim());

  return (
    <div className="stack">
      <FieldBlock tip={T_PRIMARY} label="Katalon execution logs (primary)" htmlFor="fa-logs">
        <textarea
          id="fa-logs"
          className="input"
          value={values.logs}
          onChange={(e) => onChange({ logs: e.target.value })}
          placeholder={`[INFO] Clicking element 'btn_Login'\n[INFO] Waiting for element visible\n[FAILED] Unable to click on object 'btn_Login'\ncom.kms.katalon.core.exception.StepFailedException`}
          spellCheck={false}
        />
      </FieldBlock>

      {!hasPrimaryLog && (
        <p className="hint fa-uncertainty">Paste execution logs above to run log-only analysis.</p>
      )}

      <details className="fa-more-inputs">
        <summary>Optional: report, Mobile log, stacktrace, API, screenshot</summary>

        <FieldBlock tip={T_PRIMARY} label="Katalon HTML/XML report text" htmlFor="fa-katalon">
          <textarea
            id="fa-katalon"
            className="input"
            rows={4}
            value={values.katalonReport}
            onChange={(e) => onChange({ katalonReport: e.target.value })}
            spellCheck={false}
          />
        </FieldBlock>

        <FieldBlock tip={T_PRIMARY} label="Katalon Mobile execution log" htmlFor="fa-appium">
          <textarea
            id="fa-appium"
            className="input"
            rows={4}
            value={values.appiumLog}
            onChange={(e) => onChange({ appiumLog: e.target.value })}
            spellCheck={false}
          />
        </FieldBlock>

        <FieldBlock tip={T_OPTIONAL} label="Stacktrace (optional)" htmlFor="fa-stacktrace">
          <textarea
            id="fa-stacktrace"
            className="input"
            rows={4}
            value={values.stacktrace}
            onChange={(e) => onChange({ stacktrace: e.target.value })}
            placeholder="Optional — often embedded in execution logs"
            spellCheck={false}
          />
        </FieldBlock>

        <FieldBlock tip={T_OPTIONAL} label="Console logs (optional)" htmlFor="fa-console">
          <textarea
            id="fa-console"
            className="input"
            rows={3}
            value={values.consoleLogs}
            onChange={(e) => onChange({ consoleLogs: e.target.value })}
            spellCheck={false}
          />
        </FieldBlock>

        <FieldBlock tip={T_OPTIONAL} label="API response (optional)" htmlFor="fa-api">
          <textarea
            id="fa-api"
            className="input"
            rows={3}
            value={values.apiResponse}
            onChange={(e) => onChange({ apiResponse: e.target.value })}
            spellCheck={false}
          />
        </FieldBlock>

        <FieldBlock tip={T_OPTIONAL} label="HAR / network (optional)" htmlFor="fa-har">
          <textarea
            id="fa-har"
            className="input"
            rows={2}
            value={values.harLog}
            onChange={(e) => onChange({ harLog: e.target.value })}
            spellCheck={false}
          />
        </FieldBlock>

        <FieldBlock tip={T_OPTIONAL} label="Screenshot (optional)" htmlFor="fa-screenshot-file">
          <input
            id="fa-screenshot-file"
            type="file"
            accept="image/*"
            onChange={(e) => onScreenshotFile(e.target.files?.[0] ?? null)}
          />
          {screenshotPreview && (
            <img src={screenshotPreview} alt="Upload preview" className="fa-screenshot-thumb" />
          )}
        </FieldBlock>

        <FieldBlock tip={T_OPTIONAL} label="Screenshot description" htmlFor="fa-ss-desc">
          <input
            id="fa-ss-desc"
            className="input"
            value={values.screenshotDescription}
            onChange={(e) => onChange({ screenshotDescription: e.target.value })}
            placeholder="e.g. login modal blocking submit"
          />
        </FieldBlock>
      </details>

      <div className="fa-meta-grid">
        <FieldBlock tip={T_OPTIONAL} label="Test name" htmlFor="fa-test-name">
          <input
            id="fa-test-name"
            className="input"
            value={values.testName}
            onChange={(e) => onChange({ testName: e.target.value })}
          />
        </FieldBlock>
        <FieldBlock tip={T_OPTIONAL} label="Failed step" htmlFor="fa-failed-step">
          <input
            id="fa-failed-step"
            className="input"
            value={values.failedStep}
            onChange={(e) => onChange({ failedStep: e.target.value })}
          />
        </FieldBlock>
      </div>
    </div>
  );
}
