import express from "express";
import {
  getOrCreateSession,
  handleWorkspaceChat,
  loadSession,
  saveSession,
} from "../services/aiWorkspace/index.js";
import type { WorkspaceContextPayload } from "../services/aiWorkspace/types.js";

export function createAiWorkspaceRouter(): express.Router {
  const router = express.Router();

  router.post("/chat", async (req, res, next) => {
    try {
      const body = req.body as Record<string, unknown>;
      const message = String(body.message ?? "").trim();
      if (!message) {
        res.status(400).json({ error: "message is required" });
        return;
      }
      const authorizationToken =
        typeof body.authorization_token === "string" && body.authorization_token.trim()
          ? body.authorization_token.trim()
          : (process.env.GOSI_BRAIN_AUTHORIZATION_TOKEN?.trim() ?? undefined);

      const result = await handleWorkspaceChat({
        sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
        message,
        context: (body.context ?? {}) as WorkspaceContextPayload,
        authorizationToken,
        model: typeof body.model === "string" ? body.model : undefined,
      });
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  router.post("/context", async (req, res, next) => {
    try {
      const body = req.body as { sessionId?: string; context?: WorkspaceContextPayload };
      const session = await getOrCreateSession(body.sessionId, body.context ?? {});
      session.context = { ...session.context, ...(body.context ?? {}) };
      session.updatedAt = new Date().toISOString();
      await saveSession(session);
      res.json({ sessionId: session.id, context: session.context });
    } catch (e) {
      next(e);
    }
  });

  router.get("/history/:sessionId", async (req, res, next) => {
    try {
      const session = await loadSession(req.params.sessionId);
      if (!session) {
        res.status(404).json({ error: "Session not found" });
        return;
      }
      res.json({
        sessionId: session.id,
        messages: session.messages,
        context: session.context,
        updatedAt: session.updatedAt,
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
