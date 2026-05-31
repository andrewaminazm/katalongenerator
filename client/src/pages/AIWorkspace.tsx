import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SENIOR_QA_ENGINEER_DISPLAY } from "../data/seniorQaEngineer";
import {
  fetchWorkspaceHistory,
  listKatalonProjects,
  sendWorkspaceChat,
  type ProjectMeta,
  type WorkspaceChatResponse,
  type WorkspaceContextPayload,
} from "../api";
import { useLayoutContext } from "../components/layout/LayoutContext";
import { MessageBubble, type ChatMessage } from "../components/chat/MessageBubble";
import { ChatGenerationExamples } from "../components/chat/ChatGenerationExamples";
import { Button } from "../components/ui/button";
import { WorkspaceMemoryPanel } from "../components/chat/WorkspaceMemoryPanel";
import "../components/chat/aiWorkspace.css";

const SESSION_KEY = "katalon:ai_workspace_session";
const CONTEXT_KEY = "katalon:ai_workspace_context";

function loadStoredContext(): WorkspaceContextPayload {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    if (raw) return JSON.parse(raw) as WorkspaceContextPayload;
  } catch {
    /* ignore */
  }
  return {};
}

export default function AIWorkspace() {
  const { embedded } = useLayoutContext();
  const [sessionId, setSessionId] = useState(
    () => localStorage.getItem(SESSION_KEY) ?? ""
  );
  const [context, setContext] = useState<WorkspaceContextPayload>(loadStoredContext);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryCitations, setMemoryCitations] = useState<
    WorkspaceChatResponse["memoryCitations"]
  >([]);
  const messagesRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    document.title = "Test Architect Chat — Katalon Script Generator";
    listKatalonProjects()
      .then(setProjects)
      .catch(() => setProjects([]));
    return () => {
      document.title = "Katalon Script Generator";
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(context));
  }, [context]);

  useEffect(() => {
    if (!sessionId) return;
    localStorage.setItem(SESSION_KEY, sessionId);
    fetchWorkspaceHistory(sessionId)
      .then((h) => {
        setMessages(
          h.messages.map((m) => ({
            id: m.id,
            role: m.role,
            content: m.content,
          }))
        );
        if (h.context && Object.keys(h.context).length) {
          setContext((c) => ({ ...c, ...h.context }));
        }
      })
      .catch(() => {
        /* new session */
      });
  }, []);

  const scrollToLatestContent = useCallback((behavior: ScrollBehavior = "smooth", force = false) => {
    const el = messagesRef.current;
    if (!el) return;

    if (!force && !stickToBottomRef.current) {
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom > 120) return;
    }

    const lastBubble = el.querySelector<HTMLElement>(".aiw-bubble--assistant:last-of-type");
    const codeTarget =
      lastBubble?.querySelector<HTMLElement>(".aiw-asset") ??
      lastBubble?.querySelector<HTMLElement>(".aiw-code-block") ??
      lastBubble;

    if (codeTarget) {
      const containerRect = el.getBoundingClientRect();
      const targetRect = codeTarget.getBoundingClientRect();
      const padding = 20;
      if (targetRect.bottom > containerRect.bottom - padding) {
        el.scrollTo({
          top: el.scrollTop + (targetRect.bottom - containerRect.bottom) + padding,
          behavior,
        });
        return;
      }
    }

    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const handleMessagesScroll = useCallback(() => {
    const el = messagesRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 120;
  }, []);

  useLayoutEffect(() => {
    const scroll = (behavior: ScrollBehavior) => scrollToLatestContent(behavior, true);
    scroll("auto");
    const frame = requestAnimationFrame(() => {
      scroll("smooth");
      requestAnimationFrame(() => scroll("smooth"));
    });
    const timers = [50, 150, 400].map((ms) => window.setTimeout(() => scroll("auto"), ms));
    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [messages, loading, scrollToLatestContent]);

  useEffect(() => {
    const el = messagesRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      scrollToLatestContent("smooth");
    });
    observer.observe(el);
    for (const node of el.querySelectorAll(".aiw-bubble, .aiw-asset, .aiw-code-block")) {
      observer.observe(node);
    }
    return () => observer.disconnect();
  }, [messages, scrollToLatestContent]);

  const applyResponse = useCallback((res: WorkspaceChatResponse, userText: string) => {
    setSessionId(res.sessionId);
    localStorage.setItem(SESSION_KEY, res.sessionId);
    setMemoryCitations(res.memoryCitations ?? []);
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: userText },
      {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: res.response,
        intent: res.intent,
        agent: res.agent,
        confidence: res.confidence,
        assets: res.generatedAssets,
      },
    ]);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setError(null);
      setLoading(true);
      stickToBottomRef.current = true;
      setInput("");
      try {
        const res = await sendWorkspaceChat({
          sessionId: sessionId || undefined,
          message: trimmed,
          context,
        });
        applyResponse(res, trimmed);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Chat request failed");
      } finally {
        setLoading(false);
      }
    },
    [applyResponse, context, loading, sessionId]
  );

  const newChat = () => {
    setSessionId("");
    localStorage.removeItem(SESSION_KEY);
    setMessages([]);
    setError(null);
  };

  return (
    <div className={embedded ? "aiw-root aiw-root--embedded" : "aiw-root"}>
      <div className="aiw-toolbar-row">
        {embedded ? null : (
          <header className="aiw-header">
            <div>
              <h1>Test Architect Chat</h1>
              <p>{SENIOR_QA_ENGINEER_DISPLAY} — English & Arabic plain text; long conversations supported</p>
            </div>
          </header>
        )}
        <Button variant="secondary" size="sm" onClick={newChat} className="aiw-new-chat-btn">
          New chat
        </Button>
      </div>

      <div className="aiw-layout">
        <aside className="aiw-context-panel">
          <h2 style={{ margin: "0 0 0.5rem", fontSize: "var(--text-small)", fontWeight: 600 }}>
            Context
          </h2>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--muted)" }}>
            The assistant uses this on every message — set your active project and optional API attachments.
          </p>

          <label htmlFor="aiw-project">Active project</label>
          <select
            id="aiw-project"
            value={context.projectId ?? ""}
            onChange={(e) =>
              setContext((c) => ({ ...c, projectId: e.target.value || undefined }))
            }
          >
            <option value="">— None —</option>
            {projects.map((p) => (
              <option key={p.projectId} value={p.projectId}>
                {p.projectName}
              </option>
            ))}
          </select>

          <label htmlFor="aiw-platform">Platform</label>
          <select
            id="aiw-platform"
            value={context.platform ?? "web"}
            onChange={(e) =>
              setContext((c) => ({
                ...c,
                platform: e.target.value as "web" | "mobile",
              }))
            }
          >
            <option value="web">Web</option>
            <option value="mobile">Mobile</option>
          </select>

          <label htmlFor="aiw-memory">AI memory</label>
          <select
            id="aiw-memory"
            value={context.aiMemoryMode ?? "learn_suggest"}
            onChange={(e) =>
              setContext((c) => ({
                ...c,
                aiMemoryMode: e.target.value as WorkspaceContextPayload["aiMemoryMode"],
              }))
            }
          >
            <option value="disabled">Disabled</option>
            <option value="learn_only">Learn only</option>
            <option value="learn_suggest">Learn + suggest</option>
            <option value="adaptive">Adaptive</option>
          </select>

          <label htmlFor="aiw-tab">Current tab (optional)</label>
          <input
            id="aiw-tab"
            placeholder="e.g. manual, api, performance"
            value={context.activeTab ?? ""}
            onChange={(e) =>
              setContext((c) => ({ ...c, activeTab: e.target.value || undefined }))
            }
          />

          <label htmlFor="aiw-swagger">OpenAPI / Swagger (optional)</label>
          <textarea
            id="aiw-swagger"
            placeholder="Paste JSON or YAML for API / performance tasks"
            value={context.swagger ?? ""}
            onChange={(e) =>
              setContext((c) => ({ ...c, swagger: e.target.value || undefined }))
            }
          />

          <label htmlFor="aiw-postman">Postman collection (optional)</label>
          <textarea
            id="aiw-postman"
            placeholder="Paste collection JSON"
            value={context.postmanCollection ?? ""}
            onChange={(e) =>
              setContext((c) => ({
                ...c,
                postmanCollection: e.target.value || undefined,
              }))
            }
          />

          <label htmlFor="aiw-ws-memory">
            <input
              id="aiw-ws-memory"
              type="checkbox"
              checked={context.workspaceMemoryEnabled !== false}
              onChange={(e) =>
                setContext((c) => ({
                  ...c,
                  workspaceMemoryEnabled: e.target.checked,
                }))
              }
            />{" "}
            Enterprise workspace memory
          </label>

          <WorkspaceMemoryPanel
            projectId={context.projectId}
            lastCitations={memoryCitations}
          />
        </aside>

        <div className="aiw-chat-main">
          <div
            ref={messagesRef}
            className="aiw-messages"
            role="log"
            aria-live="polite"
            onScroll={handleMessagesScroll}
          >
            {messages.length === 0 && !loading && (
              <ChatGenerationExamples onPick={(s) => void send(s)} disabled={loading} />
            )}
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {loading && <div className="aiw-thinking">Thinking…</div>}
          </div>

          {error && (
            <p style={{ color: "var(--danger)", padding: "0 1.25rem", fontSize: "var(--text-small)" }}>
              {error}
            </p>
          )}

          <div className="aiw-composer">
            <textarea
              value={input}
              placeholder="Ask in English or Arabic — project review, Groovy generation, API, performance…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              disabled={loading}
            />
            <div className="aiw-composer-actions">
              <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
                Enter to send · Shift+Enter for newline
              </span>
              <button
                type="button"
                className="aiw-btn aiw-btn-primary"
                disabled={loading || !input.trim()}
                onClick={() => void send(input)}
              >
                {loading ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
