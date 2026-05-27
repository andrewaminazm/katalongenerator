import type { ProjectIndex } from "../projectIntelligence/types.js";
import type { MemoryIndex } from "./types.js";
import { appendChunk } from "./vectorStore.js";

export function ingestFlowMemory(index: MemoryIndex, projectIndex: ProjectIndex): void {
  for (const flow of projectIndex.reusableFlows.slice(0, 20)) {
    appendChunk(index, {
      id: `flow-${flow.id}`,
      projectId: index.projectId,
      layer: "flow",
      title: flow.name,
      content: `${flow.description}\nSteps: ${flow.stepPattern.join(" → ")}\nKeywords: ${flow.relatedKeywords.join(", ")}\nOR: ${flow.relatedOrPaths.slice(0, 5).join(", ")}`,
      confidence: flow.confidence,
      source: "reusable_flows",
      updatedAt: new Date().toISOString(),
    });
  }

  const domainFlows = [
    { name: "Login flow", content: "Authentication, session, credentials, findTestObject login" },
    { name: "Checkout flow", content: "Cart, payment, order confirmation" },
    { name: "Search flow", content: "Search input, results, filters" },
  ];
  for (const f of domainFlows) {
    appendChunk(index, {
      id: `flow-generic-${f.name.replace(/\s/g, "-").toLowerCase()}`,
      projectId: index.projectId,
      layer: "flow",
      title: f.name,
      content: f.content,
      confidence: 0.5,
      source: "domain_template",
      updatedAt: new Date().toISOString(),
    });
  }
}
