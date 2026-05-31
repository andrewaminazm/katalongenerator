import type { WorkspaceIntent } from "../../api";
import { SENIOR_QA_ENGINEER_NAME } from "../../data/seniorQaEngineer";

const INTENT_LABELS: Record<WorkspaceIntent, string> = {
  generate: "Script Generation",
  api: "API Generation",
  analyze: "Coverage / Project Analysis",
  explain: "Requirement Analysis",
  heal: "Locator Healing",
  review: "Automation Review",
  optimize: "Framework Refactoring",
  performance: "Performance Testing",
  convert: "API Migration",
  document: "Documentation",
  unknown: "General QA Advisory",
};

type Props = {
  intent?: WorkspaceIntent;
  agent?: string;
  confidence?: number;
};

function labelAgent(agent?: string): string {
  if (!agent) return "";
  if (agent === "qa_advisor") return SENIOR_QA_ENGINEER_NAME;
  return agent.replace(/_/g, " ");
}

function labelIntent(intent?: WorkspaceIntent): string {
  if (!intent) return "";
  return INTENT_LABELS[intent] ?? intent;
}

export function AgentBadge({ intent, agent, confidence }: Props) {
  if (!intent && !agent) return null;
  return (
    <div className="aiw-bubble-meta">
      {intent && <span className="aiw-badge">Detected Intent: {labelIntent(intent)}</span>}
      {agent && <span className="aiw-badge">{labelAgent(agent)}</span>}
      {confidence !== undefined && (
        <span className="aiw-badge">Confidence: {Math.round(confidence * 100)}%</span>
      )}
    </div>
  );
}
