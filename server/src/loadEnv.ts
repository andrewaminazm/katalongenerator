import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let loaded = false;

/** Load server/.env and repo-root .env (first existing file wins per path, all paths merged). */
export function loadEnv(): void {
  if (loaded) return;

  const candidates: string[] = [];
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    candidates.push(path.join(here, "..", ".env"));
    candidates.push(path.join(here, "..", "..", ".env"));
  } catch {
    /* bundled / alternate runtime */
  }
  candidates.push(path.join(process.cwd(), "server", ".env"));
  candidates.push(path.join(process.cwd(), ".env"));

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      dotenv.config({ path: envPath });
    }
  }
  loaded = true;
}

export function isGosiBrainConfigured(): boolean {
  return Boolean(
    process.env.GOSI_BRAIN_CHAT_URL?.trim() && process.env.GOSI_BRAIN_API_KEY?.trim()
  );
}

export function gosiBrainConfigHint(apiBase?: string): string {
  const base = (apiBase ?? "").toLowerCase();
  if (base.includes("onrender.com")) {
    return "Add GOSI_BRAIN_CHAT_URL and GOSI_BRAIN_API_KEY in Render → your service → Environment, then redeploy.";
  }
  if (process.env.NETLIFY || process.env.LAMBDA_TASK_ROOT) {
    return "Add GOSI_BRAIN_CHAT_URL and GOSI_BRAIN_API_KEY in Netlify → Site configuration → Environment variables (all scopes), then redeploy.";
  }
  if (!base || base.includes("localhost") || base.includes("127.0.0.1")) {
    return "Add GOSI_BRAIN_CHAT_URL and GOSI_BRAIN_API_KEY to server/.env, then restart the backend (npm run dev).";
  }
  return "Add GOSI_BRAIN_CHAT_URL and GOSI_BRAIN_API_KEY on the server that hosts /api (Render, Netlify Functions, or server/.env locally).";
}
