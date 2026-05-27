import type { LocatorHealItemResult, ScriptFixItemResult } from "../../api";

type Props =
  | {
      kind: "script";
      loading: boolean;
      result: ScriptFixItemResult | null;
      onClose: () => void;
    }
  | {
      kind: "locator";
      loading: boolean;
      result: LocatorHealItemResult | null;
      pageUrl: string;
      onPageUrlChange: (v: string) => void;
      onRetryWithUrl: () => void;
      onClose: () => void;
    };

export function ItemFixPanel(props: Props) {
  const copy = (text: string) => {
    if (text) void navigator.clipboard.writeText(text);
  };

  if (props.kind === "script") {
    const { loading, result, onClose } = props;
    return (
      <div className="pi-fix-panel">
        <div className="pi-fix-panel__header">
          <strong>Script fix</strong>
          <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
            Close
          </button>
        </div>
        {loading && <p className="hint">Analyzing and regenerating script…</p>}
        {result && (
          <>
            <p className="hint">
              <code>{result.fix.logicalPath}</code>
              {result.fix.changed ? " — changes applied" : " — no automatic changes"}
            </p>
            {result.issues.length > 0 && (
              <ul className="pi-fix-issues">
                {result.issues.map((i) => (
                  <li key={i.ruleId}>
                    <span className={`pi-severity pi-severity--${i.severity}`}>{i.severity}</span>{" "}
                    {i.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="pi-fix-columns">
              <div>
                <span className="field-label">Original</span>
                <pre className="code-pre pi-fix-pre">{result.fix.original || "(empty — re-upload project)"}</pre>
              </div>
              <div>
                <span className="field-label">Fixed</span>
                <pre className="code-pre pi-fix-pre">{result.fix.fixed || "(no changes)"}</pre>
              </div>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-primary btn-small"
                disabled={!result.fix.fixed}
                onClick={() => copy(result.fix.fixed)}
              >
                Copy fixed script
              </button>
            </div>
            {result.fix.diffSummary.length > 0 && (
              <p className="hint">{result.fix.diffSummary.join(" · ")}</p>
            )}
          </>
        )}
      </div>
    );
  }

  const { loading, result, pageUrl, onPageUrlChange, onRetryWithUrl, onClose } = props;
  return (
    <div className="pi-fix-panel">
      <div className="pi-fix-panel__header">
        <strong>Locator healing</strong>
        <button type="button" className="btn btn-ghost btn-small" onClick={onClose}>
          Close
        </button>
      </div>
      <label className="field-label" htmlFor="pi-heal-url">
        Page URL (for Playwright analysis)
      </label>
      <div className="row-actions" style={{ marginBottom: "0.5rem" }}>
        <input
          id="pi-heal-url"
          className="input"
          value={pageUrl}
          onChange={(e) => onPageUrlChange(e.target.value)}
          placeholder="https://your-app.example.com/login"
          dir="ltr"
        />
        <button type="button" className="btn btn-ghost btn-small" onClick={onRetryWithUrl} disabled={loading}>
          Re-run with URL
        </button>
      </div>
      {loading && <p className="hint">Finding best locator…</p>}
      {result && (
        <>
          <p className="hint">
            <code>{result.orPath}</code> — confidence {(result.confidence * 100).toFixed(0)}%
            {result.playwrightUsed ? " · Playwright" : " · OR analysis only"}
          </p>
          <p className="hint">{result.reason}</p>
          {result.warnings.map((w, i) => (
            <p key={i} className="hint" style={{ color: "var(--warn, #b45309)" }}>
              {w}
            </p>
          ))}
          <div className="pi-locator-compare">
            <div>
              <span className="field-label">Current</span>
              <code className="loc-convert-code">
                {result.oldLocator.type}: {result.oldLocator.value}
              </code>
            </div>
            <div>
              <span className="field-label">Suggested</span>
              <code className="loc-convert-code">
                {result.newLocator.type}: {result.newLocator.value}
              </code>
            </div>
          </div>
          {result.candidates.length > 1 && (
            <div style={{ marginTop: "0.5rem" }}>
              <span className="field-label">Ranked candidates</span>
              <ul className="pi-fix-issues">
                {result.candidates.map((c) => (
                  <li key={`${c.type}-${c.value}`}>
                    <strong>{c.score}</strong> {c.type}: {c.value}{" "}
                    <span className="hint">({c.source})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <pre className="code-pre pi-fix-pre">{result.rsPreview}</pre>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => copy(result.katalonSnippet)}
            >
              Copy Katalon locator
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => copy(result.rsPreview)}>
              Copy OR hint
            </button>
          </div>
          {result.impactedScripts.length > 0 && (
            <p className="hint">
              Impacted scripts: {result.impactedScripts.slice(0, 5).join(", ")}
              {result.impactedScripts.length > 5 ? "…" : ""}
            </p>
          )}
        </>
      )}
    </div>
  );
}
