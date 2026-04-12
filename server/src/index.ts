import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });
import express from "express";
import { createApiRouter } from "./routes/api.js";

const PORT = Number(process.env.PORT) || 8787;

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

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

const server = app.listen(PORT, () => {
  console.log(`Katalon Ollama server listening on http://localhost:${PORT}`);
});
server.setTimeout(200000);
