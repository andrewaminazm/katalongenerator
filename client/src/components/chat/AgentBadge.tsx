import type { WorkspaceAgent, WorkspaceIntent } from "../../api";

type Props = {
  intent?: WorkspaceIntent;
  agent?: WorkspaceAgent;
  confidence?: number;
};

function labelAgent(agent?: WorkspaceAgent): string {
  if (!agent) return "";
  return agent.replace(/_/g, " ");
}

export function AgentBadge({ intent, agent, confidence }: Props) {
  if (!intent && !agent) return null;
  return (
    <div className="aiw-bubble-meta">
      {intent && <span className="aiw-badge">Intent: {intent}</span>}
      {agent && <span className="aiw-badge">{labelAgent(agent)}</span>}
      {confidence !== undefined && (
        <span className="aiw-badge">{Math.round(confidence * 100)}% match</span>
      )}
    </div>
  );
}
