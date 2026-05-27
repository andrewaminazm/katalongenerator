import { loadEnv } from "./loadEnv.js";
import cors from "cors";

loadEnv();
import express from "express";
import { createApiRouter } from "./routes/api.js";
import { createProjectIntelligenceRouter } from "./routes/projectIntelligenceRoutes.js";
import { createFailureRouter } from "./routes/failureRoutes.js";
import { createApiGeneratorRouter } from "./routes/apiGeneratorRoutes.js";
import { createPostmanRouter } from "./routes/postmanRoutes.js";
import { createPerformanceRouter } from "./routes/performanceRoutes.js";
import { createAiWorkspaceRouter } from "./routes/aiWorkspaceRoutes.js";
import { createCoverageRouter } from "./routes/coverageRoutes.js";
import { createRefactorRouter } from "./routes/refactorRoutes.js";
import { createProjectGeneratorRouter } from "./routes/projectGeneratorRoutes.js";
import { logJiraTlsStartupHint } from "./services/jira.js";

logJiraTlsStartupHint();

export const app = express();

// ALLOWED_ORIGINS: comma-separated list of allowed origins, e.g.
// "https://yoursite.netlify.app,https://custom-domain.com"
// Falls back to allowing all origins when not set (local dev).
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ?.split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins?.length
      ? (origin, cb) => {
          if (!origin || allowedOrigins.includes(origin)) cb(null, true);
          else cb(new Error(`CORS: origin ${origin} not allowed`));
        }
      : true,
    credentials: true,
  })
);
app.use(express.json({ limit: "8mb" }));

// Render/health convenience: this service is primarily an API backend.
// The frontend is hosted separately (e.g. Netlify). Without this route, opening the Render
// URL directly shows "Cannot GET /".
app.get("/", (_req, res) => {
  res
    .status(200)
    .type("html")
    .send(
      [
        "<!doctype html>",
        "<html>",
        "<head><meta charset=\"utf-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
        "<title>Katalon Script Generator API</title></head>",
        "<body style=\"font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px;\">",
        "<h2 style=\"margin: 0 0 8px;\">Katalon Script Generator — API backend</h2>",
        "<p style=\"margin: 0 0 16px; color: #555;\">This Render service hosts the backend API. The web UI is hosted separately.</p>",
        "<ul>",
        "<li><code>/api/health</code> (API health)</li>",
        "<li><code>/api/project-generator/templates</code></li>",
        "<li><code>/api/project-generator/analyze</code> (POST)</li>",
        "<li><code>/api/project-generator/generate</code> (POST)</li>",
        "</ul>",
        "</body></html>",
      ].join("")
    );
});

app.use("/api", createApiRouter());
app.use("/api/projects", createProjectIntelligenceRouter());
app.use("/api/failure", createFailureRouter());
app.use("/api/api-generator", createApiGeneratorRouter());
app.use("/api/postman", createPostmanRouter());
app.use("/api/performance", createPerformanceRouter());
app.use("/api/ai-workspace", createAiWorkspaceRouter());
app.use("/api/coverage", createCoverageRouter());
app.use("/api/refactor", createRefactorRouter());
app.use("/api/project-generator", createProjectGeneratorRouter());

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

// Only start the HTTP server when running directly (local dev / Node process).
// When imported as a module (Netlify Function / serverless-http), skip listen().
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("index.ts") ||
    process.argv[1].endsWith("index.js") ||
    process.argv[1].includes("tsx"));

if (isMain || (!process.env.NETLIFY && !process.env.LAMBDA_TASK_ROOT)) {
  const PORT = Number(process.env.PORT) || 8787;

  const server = app.listen(PORT, () => {
    console.log(`Katalon Ollama server listening on http://localhost:${PORT}`);
  });

  // Default 0 = no HTTP keep-alive timeout.
  const rawTimeout = process.env.SERVER_REQUEST_TIMEOUT_MS?.trim();
  const timeoutMs = rawTimeout !== undefined && rawTimeout !== "" ? Number(rawTimeout) : 0;
  server.setTimeout(Number.isFinite(timeoutMs) && timeoutMs >= 0 ? timeoutMs : 0);
  if (timeoutMs > 0) {
    console.log(`HTTP server request timeout: ${timeoutMs} ms`);
  }
}
