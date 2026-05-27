import { DOC_SECTIONS } from "./sections";
import type { DocCategory, DocSearchHit, DocSection } from "./types";

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function snippetAround(text: string, term: string, max = 120): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(term);
  if (idx < 0) return text.slice(0, max) + (text.length > max ? "…" : "");
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + term.length + 80);
  const chunk = text.slice(start, end).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + chunk + (end < text.length ? "…" : "");
}

function sectionHaystack(section: DocSection): string {
  const parts = [
    section.title,
    section.summary,
    section.content,
    section.category,
    ...(section.steps ?? []),
    ...(section.examples ?? []),
    ...(section.tips ?? []),
    ...(section.warnings ?? []),
    ...(section.mistakes ?? []),
    ...(section.keywords ?? []),
  ];
  return parts.join(" ").toLowerCase();
}

export function searchDocumentation(
  query: string,
  categoryFilter: DocCategory | "all"
): DocSearchHit[] {
  const terms = tokenize(query);
  const hits: DocSearchHit[] = [];

  for (const section of DOC_SECTIONS) {
    if (categoryFilter !== "all" && section.category !== categoryFilter) continue;

    const haystack = sectionHaystack(section);
    let score = 0;

    if (terms.length === 0) {
      score = 1;
    } else {
      for (const term of terms) {
        if (section.id.includes(term)) score += 8;
        if (section.title.toLowerCase().includes(term)) score += 6;
        if (section.keywords?.some((k) => k.toLowerCase().includes(term))) score += 5;
        if (haystack.includes(term)) score += 2;
      }
      if (score === 0) continue;
    }

    const primaryTerm = terms[0] ?? section.title.split(" ")[0].toLowerCase();
    const snippet = snippetAround(
      section.summary || section.content,
      primaryTerm,
      140
    );

    hits.push({
      sectionId: section.id,
      title: section.title,
      category: section.category,
      snippet,
      score,
    });
  }

  return hits.sort((a, b) => b.score - a.score);
}

export function getSectionById(id: string): DocSection | undefined {
  return DOC_SECTIONS.find((s) => s.id === id);
}
