export type DocCategory =
  | "getting-started"
  | "generation"
  | "integration"
  | "intelligence"
  | "advanced";

export type DocSection = {
  id: string;
  title: string;
  category: DocCategory;
  /** Short summary shown in search results and section header. */
  summary: string;
  content: string;
  steps?: string[];
  examples?: string[];
  tips?: string[];
  warnings?: string[];
  /** Common mistakes QA teams make with this feature. */
  mistakes?: string[];
  /** Extra terms for smart search (synonyms, acronyms). */
  keywords?: string[];
  /** Screenshot / GIF placeholder labels (assets can be wired later). */
  mediaPlaceholders?: string[];
};

export type DocSearchHit = {
  sectionId: string;
  title: string;
  category: DocCategory;
  snippet: string;
  score: number;
};
