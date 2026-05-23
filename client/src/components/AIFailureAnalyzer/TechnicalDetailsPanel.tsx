import type { FailureAnalysisResult } from "../../api";
import { RootCauseCard } from "./RootCauseCard";
import { DetectedPatternsPanel } from "./DetectedPatternsPanel";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { FlakyDetector } from "./FlakyDetector";
import { LocatorIssuePanel } from "./LocatorIssuePanel";
import { TimingIssuePanel } from "./TimingIssuePanel";
import { ApiFailurePanel } from "./ApiFailurePanel";
import { FailureTimeline } from "./FailureTimeline";

export function TechnicalDetailsPanel({
  result,
}: {
  result: FailureAnalysisResult;
}) {
  return (
    <details className="fa-technical-details">
      <summary>Technical details (for SDETs)</summary>
      <div className="fa-results-stack fa-technical-inner">
        <RootCauseCard result={result} />
        <DetectedPatternsPanel result={result} />
        <div className="fa-grid-2">
          <ConfidenceMeter result={result} />
          <FlakyDetector result={result} />
        </div>
        <LocatorIssuePanel result={result} />
        <TimingIssuePanel result={result} />
        <ApiFailurePanel result={result} />
        <FailureTimeline result={result} />
      </div>
    </details>
  );
}
