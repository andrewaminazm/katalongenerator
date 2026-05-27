import type { MemoryIndex, MemoryRecommendation } from "./types.js";

export function buildRecommendations(index: MemoryIndex): MemoryRecommendation[] {
  const recs: MemoryRecommendation[] = [];

  const flows = index.chunks.filter((c) => c.layer === "flow");
  if (flows.length > 0) {
    recs.push({
      id: "rec-reuse-flows",
      title: "Reuse documented business flows",
      detail: `${flows.length} flows indexed — extract shared Custom Keywords instead of duplicating scripts.`,
      layer: "flow",
      confidence: 0.85,
      basedOn: flows.slice(0, 3).map((f) => f.id),
    });
  }

  const locators = index.chunks.filter((c) => c.layer === "locator");
  if (locators.length > 3) {
    recs.push({
      id: "rec-heal-locators",
      title: "Strengthen weak locators",
      detail: "Multiple OR entries flagged — run Project Repair or locator healing.",
      layer: "locator",
      confidence: 0.8,
      basedOn: locators.slice(0, 3).map((l) => l.id),
    });
  }

  const repair = index.chunks.find((c) => c.layer === "repair");
  if (repair) {
    recs.push({
      id: "rec-review-repair",
      title: "Review latest repair analysis",
      detail: "Repair memory available — discuss flaky modules and applied fixes in chat.",
      layer: "repair",
      confidence: 0.75,
      basedOn: [repair.id],
    });
  }

  return recs.slice(0, 6);
}
