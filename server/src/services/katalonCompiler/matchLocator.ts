import type { ResolvedLocator } from "./types.js";

/** Used to prefer labels/selectors that fit the step intent (click vs type). */
export type LocatorMatchIntent = "click" | "type" | "check" | "verify" | "default";

function normKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Collapse spaces for substring / fuzzy comparison. */
function compact(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "").trim();
}

/** Apply light synonym normalization to hints and labels. */
function applySynonyms(phrase: string): string {
  let x = phrase.toLowerCase().trim();
  x = x.replace(/\b(sign\s*in|sign-in|log\s*in)\b/gi, "login");
  x = x.replace(/\bfind\b/gi, "search");
  x = x.replace(/\b(continue|send)\b/gi, "submit");
  return x.replace(/\s+/g, " ").trim();
}

/** Sørensen–Dice coefficient on bigrams, range [0,1]. */
function diceSimilarity(a: string, b: string): number {
  const A = a.toLowerCase();
  const B = b.toLowerCase();
  if (!A.length || !B.length) return A === B ? 1 : 0;
  if (A === B) return 1;
  if (A.length < 2 && B.length < 2) return A === B ? 1 : 0;
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      m.set(bg, (m.get(bg) ?? 0) + 1);
    }
    return m;
  };
  const bgA = bigrams(A);
  const bgB = bigrams(B);
  let inter = 0;
  for (const [k, va] of bgA) {
    if (!bgB.has(k)) continue;
    inter += Math.min(va, bgB.get(k)!);
  }
  const denom = A.length - 1 + (B.length - 1);
  return denom === 0 ? 0 : (2 * inter) / denom;
}

function actionAffinityBonus(intent: LocatorMatchIntent | undefined, loc: ResolvedLocator): number {
  if (!intent || intent === "default") return 0;
  const label = loc.label.toLowerCase();
  const val = loc.value.toLowerCase();
  const blob = `${label} ${val}`;

  if (intent === "click") {
    if (/\b(google search|search button|submit|btn)\b/.test(label)) return 80;
    if (/\/\/(button|a)\b/.test(val) || /\[name\s*=\s*['"]btnk['"]\]/i.test(val)) return 70;
    if (/\b(button|link)\b/.test(label) || /\brole\s*=\s*['"]button['"]/.test(val)) return 55;
    if (/\[name\s*=\s*['"]q['"]\](?!.*btn)/i.test(val) && !/button|submit|search/.test(label)) return -120;
    if (/\b(input|textarea|textbox|field|box)\b/.test(label) && !/button|submit|link/.test(label)) return -90;
  }

  if (intent === "type") {
    if (/\[name\s*=\s*['"]q['"]\]|textbox|textarea|placeholder|aria-label/.test(blob)) return 70;
    if (/\/\/(input|textarea)/.test(val) || /@type\s*=\s*['"]text/.test(val)) return 60;
    if (/\b(button|submit|btn)\b/.test(label) && !/\b(search|field|box|input)\b/.test(label)) return -80;
  }

  if (intent === "check" || intent === "verify") {
    if (/\b(checkbox|check|radio)\b/.test(blob)) return 40;
  }

  return 0;
}

export interface MatchLocatorOptions {
  intent?: LocatorMatchIntent;
}

/**
 * Match step hint to the best locator label.
 * Full phrase / longest label wins over partial (e.g. "Google Search" beats "Search").
 * Uses synonyms, Dice similarity (threshold 0.7), and optional action-aware bias.
 */
export function matchLocatorByHint(
  hint: string,
  locs: ResolvedLocator[],
  options?: MatchLocatorOptions
): ResolvedLocator | undefined {
  const hRaw = hint.trim();
  if (!hRaw) {
    return locs[0];
  }

  const h = normKey(hRaw);
  const hCompact = compact(applySynonyms(hRaw));
  const intent = options?.intent ?? "default";

  type Scored = { loc: ResolvedLocator; score: number };
  const scored: Scored[] = [];

  for (const loc of locs) {
    const L = normKey(loc.label);
    const Lsyn = applySynonyms(loc.label);
    const Lc = compact(Lsyn);

    let score = 0;

    if (L === h || Lsyn.toLowerCase() === hRaw.toLowerCase().trim()) {
      score = 1_000_000;
    } else if (Lc === hCompact && hCompact.length > 0) {
      score = 950_000;
    } else if (L.includes(h) && h.length >= 2) {
      score = 800_000 + L.length * 100;
    } else if (h.includes(L) && L.length >= 2) {
      score = 700_000 + L.length * 100;
    } else {
      const dice = Math.max(diceSimilarity(h, L), diceSimilarity(hCompact, Lc));
      if (dice >= 0.7) {
        score = 500_000 + Math.floor(dice * 100_000);
      } else {
        const words = h.split(/\s+/).filter((w) => w.length > 1);
        const wordScore = words.reduce((acc, w) => acc + (L.includes(w) ? 40 : 0), 0);
        if (wordScore > 0) score = 100_000 + wordScore;
      }
    }

    const lexicalScore = score;
    // Intent bias must not create a match from zero lexical overlap (e.g. hint "Settings" +
    // label "Google Search" would otherwise get +80 click affinity and win).
    const adjusted = lexicalScore + actionAffinityBonus(intent, loc);

    if (lexicalScore > 0) {
      scored.push({ loc, score: adjusted });
    }
  }

  if (scored.length === 0) {
    return undefined;
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.loc.label.length - a.loc.label.length;
  });

  return scored[0].loc;
}
