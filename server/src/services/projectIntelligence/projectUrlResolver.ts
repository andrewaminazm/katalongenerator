import fs from "node:fs/promises";
import path from "node:path";
import { projectDir } from "./projectStore.js";

const URL_IN_GROOVY_RE =
  /(?:WebUI\.(?:openBrowser|navigateToUrl)|openToUrl)\s*\(\s*['"]([^'"]+)['"]/gi;

const SKIP_URLS = new Set(["", "about:blank", "about:blank/"]);

/** Phrases that mean "use the indexed project's application URL". */
export function stepRequestsProjectWebsite(step: string): boolean {
  const lower = step.trim().toLowerCase();
  if (!lower) return false;
  if (/\bhttps?:\/\//i.test(lower)) return false;
  if (
    /\b(visit|open|go\s+to|navigate(?:\s+to)?|launch|load)\b/.test(lower) &&
    /\b(my|our|the|this)\s+(website|site|web\s*app|application|homepage|home\s*page)\b/.test(lower)
  ) {
    return true;
  }
  if (/\b(website|site|web\s*app)\b/.test(lower) && /\b(in\s+)?(my\s+)?project\b/.test(lower)) {
    return true;
  }
  if (/\bvisit\s+(the\s+)?(app|application)\b/.test(lower)) {
    return true;
  }
  return false;
}

function collectUrlsFromText(text: string, counts: Map<string, number>): void {
  for (const m of text.matchAll(URL_IN_GROOVY_RE)) {
    let u = m[1]?.trim() ?? "";
    if (!u || SKIP_URLS.has(u.toLowerCase())) continue;
    if (!/^https?:\/\//i.test(u)) continue;
    counts.set(u, (counts.get(u) ?? 0) + 1);
  }
}

async function walkGroovyFiles(
  dir: string,
  onFile: (content: string, rel: string) => void,
  depth = 0
): Promise<void> {
  if (depth > 12) return;
  let entries: { name: string; isDirectory: () => boolean }[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".git") continue;
      await walkGroovyFiles(abs, onFile, depth + 1);
      continue;
    }
    if (!/\.groovy$/i.test(ent.name)) continue;
    try {
      const content = await fs.readFile(abs, "utf8");
      onFile(content, ent.name);
    } catch {
      /* skip unreadable */
    }
  }
}

function pickDominantUrl(counts: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const [url, count] of counts) {
    let score = count;
    if (/\/en\/?$/i.test(url) || /\/en\/$/i.test(url)) score += 2;
    if (url.includes("gpt-qa") || url.includes("localhost")) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = url;
    }
  }
  return best;
}

/**
 * Infer the team's primary application URL from indexed project sources
 * (Test Suites, Scripts, Keywords).
 */
export async function extractProjectDefaultUrl(projectId: string): Promise<string | undefined> {
  const sourceRoot = path.join(projectDir(projectId), "source");
  const counts = new Map<string, number>();

  const suitesDir = path.join(sourceRoot);
  await walkGroovyFiles(suitesDir, (content, name) => {
    collectUrlsFromText(content, counts);
    if (name.includes("parallel") || name.includes("Suite")) {
      collectUrlsFromText(content, counts);
    }
  });

  return pickDominantUrl(counts);
}
