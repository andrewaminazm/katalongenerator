export type MemoryLayer =
  | "project"
  | "workspace"
  | "team"
  | "framework"
  | "flow"
  | "locator"
  | "assertion"
  | "api"
  | "repair"
  | "risk"
  | "architecture"
  | "documentation"
  | "pattern";

export interface MemoryChunk {
  id: string;
  projectId: string;
  layer: MemoryLayer;
  title: string;
  content: string;
  terms: Record<string, number>;
  confidence: number;
  source: string;
  updatedAt: string;
}

export interface MemoryIndex {
  projectId: string;
  projectName: string;
  indexedAt: string;
  chunkCount: number;
  chunks: MemoryChunk[];
}

export interface MemorySearchHit {
  chunk: MemoryChunk;
  score: number;
  whyRelevant: string;
}

export interface MemorySearchResult {
  projectId: string;
  query: string;
  hits: MemorySearchHit[];
  searchedAt: string;
}

export interface MemoryInsights {
  projectId: string;
  projectName: string;
  memoryChunkCount: number;
  layerCounts: Record<string, number>;
  topFlows: { name: string; description: string }[];
  repairSummary?: string;
  riskHints: string[];
  recommendations: MemoryRecommendation[];
  graphSummary: { nodes: number; edges: number };
}

export interface MemoryRecommendation {
  id: string;
  title: string;
  detail: string;
  layer: MemoryLayer;
  confidence: number;
  basedOn: string[];
}

export interface LearnMemoryInput {
  projectId: string;
  layer: MemoryLayer;
  title: string;
  content: string;
  source?: "user_approval" | "user_correction" | "chat" | "repair" | "generation";
}

export interface RetrievalContext {
  injectionText: string;
  citations: Array<{ id: string; layer: MemoryLayer; title: string; score: number }>;
  hitCount: number;
}
