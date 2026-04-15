export interface OrSuggestion {
  path: string;
  /** 0–1 heuristic confidence */
  score: number;
}

export interface StepOrMatch {
  step: string;
  suggestions: OrSuggestion[];
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9_/]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function bareSegment(seg: string): string {
  return seg.replace(/^(btn|txt|etxt|input|lbl|link|chk|ddl|tab|ico)_/i, "");
}

function scoreStepAgainstPath(step: string, path: string): number {
  const s = step.toLowerCase();
  const lowerPath = path.toLowerCase();
  if (s.includes(lowerPath)) return 1;
  const segments = path.split("/").filter(Boolean);
  let best = 0;
  for (const seg of segments) {
    const sl = seg.toLowerCase();
    if (sl.length < 2) continue;
    if (s.includes(sl)) best = Math.max(best, 0.88);
    const bare = bareSegment(sl);
    if (bare.length > 2 && s.includes(bare)) best = Math.max(best, 0.72);
    const tokens = tokenize(step);
    for (const t of tokens) {
      if (t.length > 2 && (sl.includes(t) || bare.includes(t))) {
        best = Math.max(best, 0.55);
      }
    }
  }
  const pathTokens = tokenize(path.replace(/\//g, " "));
  for (const pt of pathTokens) {
    if (pt.length > 2 && s.includes(pt)) best = Math.max(best, 0.62);
  }
  return Math.min(1, best);
}

/**
 * Suggest closest Object Repository paths per manual step (heuristic).
 */
export function matchStepsToOr(
  steps: string[],
  objectRepositoryPaths: string[]
): StepOrMatch[] {
  const paths = [...new Set(objectRepositoryPaths.map((p) => p.trim()).filter(Boolean))];
  return steps.map((step) => {
    const scored = paths
      .map((path) => ({ path, score: scoreStepAgainstPath(step, path) }))
      .filter((x) => x.score >= 0.2)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    return { step, suggestions: scored };
  });
}

/** Max OR paths embedded in the LLM prompt (full list still used for lint). Override with KATALON_OR_PROMPT_MAX_PATHS. */
export function getMaxOrPathsInPrompt(): number {
  const n = Number(process.env.KATALON_OR_PROMPT_MAX_PATHS);
  return Number.isFinite(n) && n >= 20 ? Math.floor(n) : 220;
}

/**
 * Chooses which Object Repository paths to list in the prompt. Large projects (hundreds of .rs)
 * blow past local model context limits and can make Ollama/Gemini fail; we keep step-relevant
 * paths first, then fill with the rest alphabetically.
 */
export function selectOrPathsForPrompt(
  objectRepositoryPaths: string[],
  steps: string[],
  maxPaths: number = getMaxOrPathsInPrompt()
): { shown: string[]; total: number; truncated: boolean } {
  const unique = [...new Set(objectRepositoryPaths.map((p) => p.trim()).filter(Boolean))];
  const total = unique.length;
  if (total === 0) {
    return { shown: [], total: 0, truncated: false };
  }
  if (total <= maxPaths) {
    return {
      shown: [...unique].sort((a, b) => a.localeCompare(b)),
      total,
      truncated: false,
    };
  }
  const matches = matchStepsToOr(steps, unique);
  const priority: string[] = [];
  const seen = new Set<string>();
  for (const m of matches) {
    for (const s of m.suggestions) {
      if (!seen.has(s.path)) {
        seen.add(s.path);
        priority.push(s.path);
      }
    }
  }
  const rest = unique.filter((p) => !seen.has(p)).sort((a, b) => a.localeCompare(b));
  const combined = [...priority, ...rest];
  return {
    shown: combined.slice(0, maxPaths),
    total,
    truncated: true,
  };
}

export function formatOrSuggestionsForPrompt(matches: StepOrMatch[]): string {
  const lines: string[] = [
    "STEP → OBJECT REPOSITORY SUGGESTIONS (heuristic scores 0–1; verify in Katalon Studio before relying on them):",
  ];
  for (const m of matches) {
    if (!m.suggestions.length) {
      lines.push(`- Step: "${m.step}" → (no strong OR match in uploaded list)`);
      continue;
    }
    const top = m.suggestions
      .slice(0, 5)
      .map((s) => `${s.path} (${s.score.toFixed(2)})`)
      .join(", ");
    lines.push(`- Step: "${m.step}" → ${top}`);
  }
  return lines.join("\n");
}
