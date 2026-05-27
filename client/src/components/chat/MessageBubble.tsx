import type { WorkspaceAgent, WorkspaceIntent } from "../../api";
import { AgentBadge } from "./AgentBadge";
import { CodeBlock } from "./CodeBlock";
import { MarkdownLite } from "./MarkdownLite";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: WorkspaceIntent;
  agent?: WorkspaceAgent;
  confidence?: number;
  assets?: Array<{ kind: string; title: string; content: string; language?: string }>;
};

type Props = {
  message: ChatMessage;
};

export function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`aiw-bubble aiw-bubble--${message.role}`}>
      {!isUser && (
        <AgentBadge intent={message.intent} agent={message.agent} confidence={message.confidence} />
      )}
      {isUser ? <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.content}</p> : <MarkdownLite text={message.content} />}
      {message.assets?.map((a) => (
        <details key={a.title} className="aiw-asset" open={a.kind === "groovy"}>
          <summary>{a.title}</summary>
          <CodeBlock code={a.content} language={a.language} />
        </details>
      ))}
    </div>
  );
}
