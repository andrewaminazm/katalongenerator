import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
import express from "express";
import { createApiRouter } from "./routes/api.js";
import { logJiraTlsStartupHint } from "./services/jira.js";

const PORT = Number(process.env.PORT) || 8787;

logJiraTlsStartupHint();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "8mb" }));

app.use("/api", createApiRouter());

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err);
    const message = err instanceof Error ? err.message : "Internal server error";
    res.status(500).json({ error: message });
  }
);

const ollamaBase =
  process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:11434";

const server = app.listen(PORT, () => {
  console.log(`Katalon Ollama server listening on http://localhost:${PORT}`);
  console.log(`Ollama API (generate): ${ollamaBase} — if generate fails with "fetch failed", run ollama serve and check this URL matches`);
});

// Default 0 = no HTTP keep-alive timeout. Slow local Ollama + large imported OR lists often exceed 200s;
// a finite timeout was closing the socket mid-generation (browser showed "Internal Server Error").
const rawTimeout = process.env.SERVER_REQUEST_TIMEOUT_MS?.trim();
const timeoutMs = rawTimeout !== undefined && rawTimeout !== "" ? Number(rawTimeout) : 0;
server.setTimeout(Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : 0);
if (timeoutMs > 0) {
  console.log(`HTTP server request timeout: ${timeoutMs} ms`);
}
