import { TipIcon } from "../../FieldTip";
import { TIPS } from "../../fieldTips";
import { useFailureAnalyzer } from "./FailureAnalyzerContext";
import { PlainEnglishSummary } from "./PlainEnglishSummary";
import { SuggestedFixes } from "./SuggestedFixes";
import { ScreenshotViewer } from "./ScreenshotViewer";
import { TechnicalDetailsPanel } from "./TechnicalDetailsPanel";

export function FailureAnalyzerResults() {
  const { loading, result, screenshotPreview } = useFailureAnalyzer();

  return (
    <>
      <div className="code-panel-header">
        <span className="field-label">Analysis results</span>
        <TipIcon tip={TIPS.tabFailure} />
      </div>

      {!result && !loading && (
        <p className="hint fa-empty">
          Results appear here after you analyze — root cause, confidence, flaky probability, and
          recommended fixes.
        </p>
      )}
      {loading && <p className="hint">Analyzing failure like a senior SDET…</p>}
      {result && (
        <div className="fa-results-stack">
          <PlainEnglishSummary result={result} />
          <SuggestedFixes result={result} />
          <ScreenshotViewer previewUrl={screenshotPreview} insights={result.screenshotInsights} />
          <TechnicalDetailsPanel result={result} />
          {result.healingSuggestions.length > 0 && (
            <div className="fa-card">
              <h3>Locator healing</h3>
              <ul>
                {result.healingSuggestions.map((h) => (
                  <li key={h.endpoint}>
                    <code>{h.endpoint}</code> — {h.description}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.relatedPatterns.length > 0 && (
            <div className="fa-card">
              <h3>Recurring patterns</h3>
              <ul>
                {result.relatedPatterns.map((p) => (
                  <li key={p.id}>
                    {p.occurrences}× — {p.signature.slice(0, 80)}
                    {p.flakyRate != null && ` (avg flaky ${Math.round(p.flakyRate * 100)}%)`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.projectContext && (
            <div className="fa-card">
              <h3>Project intelligence</h3>
              <ul className="hint">
                {result.projectContext.matchedKeyword && (
                  <li>Keyword: {result.projectContext.matchedKeyword}</li>
                )}
                {result.projectContext.matchedOrPath && (
                  <li>Object Repository: {result.projectContext.matchedOrPath}</li>
                )}
                {result.projectContext.sourceFileHint && (
                  <li>Source: {result.projectContext.sourceFileHint}</li>
                )}
              </ul>
            </div>
          )}
          {result.architectureInsights.length > 0 && (
            <div className="fa-card">
              <h3>Architecture insights</h3>
              <ul>
                {result.architectureInsights.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </>
  );
}
