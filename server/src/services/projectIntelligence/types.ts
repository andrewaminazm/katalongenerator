/** Generation reuse policy when an active project is selected. */
export type ProjectGenerationMode = "strict_reuse" | "balanced" | "generate_everything";

export type SelectorType = "XPATH" | "CSS" | "BASIC" | "ID" | "NAME" | "UNKNOWN";

export interface ParsedTestObject {
  label: string;
  path: string;
  selectorType: SelectorType;
  selector: string;
  alternativeSelectors: { type: SelectorType; value: string }[];
  sourceFile: string;
}

export interface ParsedKeywordMethod {
  name: string;
  signature: string;
  parameters: string[];
  docComment?: string;
  /** Heuristic one-line summary for matching */
  semanticSummary: string;
}

export interface ParsedKeywordClass {
  packageName: string;
  className: string;
  filePath: string;
  methods: ParsedKeywordMethod[];
  /** Full CustomKeywords path prefix: com.company.LoginKeywords */
  customKeywordsPath: string;
}

export type TestScriptKind = "scripts" | "test_case" | "include" | "lib" | "listener";

export interface ParsedTestScript {
  /** Stable id for graph / search (folder-based, not raw Script123.groovy). */
  logicalPath: string;
  scriptPath: string;
  kind: TestScriptKind;
  displayName: string;
  findTestObjectRefs: string[];
  customKeywordRefs: string[];
  stepComments: string[];
  webUiCalls: string[];
  lineCount: number;
  semanticSummary: string;
}

/** @deprecated Use ParsedTestScript */
export type ParsedTestCaseAsset = ParsedTestScript;

export interface ReusableFlow {
  id: string;
  name: string;
  description: string;
  stepPattern: string[];
  confidence: number;
  relatedKeywords: string[];
  relatedOrPaths: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  type:
    | "uses_test_object"
    | "calls_keyword"
    | "test_script_uses_keyword"
    | "test_case_uses_keyword"
    | "keyword_calls_keyword";
}

export interface ProjectKnowledgeGraphData {
  nodes: { id: string; kind: "keyword" | "test_object" | "test_script" | "flow" }[];
  edges: GraphEdge[];
}

export interface ProjectIndexStats {
  testObjects: number;
  keywords: number;
  keywordMethods: number;
  testScripts: number;
  /** @deprecated Use testScripts */
  testCases?: number;
  testSuites: number;
  profiles: number;
  groovyLibs: number;
  parseErrors: number;
}

export interface ProjectIndex {
  projectId: string;
  projectName: string;
  uploadDate: string;
  sourceType: "zip" | "rar" | "folder";
  testObjects: ParsedTestObject[];
  keywords: ParsedKeywordClass[];
  testScripts: ParsedTestScript[];
  /** @deprecated Legacy index field */
  testCases?: ParsedTestScript[];
  testSuitePaths: string[];
  profilePaths: string[];
  globalVariableHints: string[];
  reusableFlows: ReusableFlow[];
  graph: ProjectKnowledgeGraphData;
  stats: ProjectIndexStats;
  codingStyleHints: string[];
}

export interface ProjectMeta {
  projectId: string;
  projectName: string;
  uploadDate: string;
  sourceType: "zip" | "rar" | "folder";
  stats: ProjectIndexStats;
}

export interface SemanticMatchResult<T> {
  item: T;
  score: number;
  reason: string;
}

export interface StepBinding {
  stepIndex: number;
  stepText: string;
  orPath?: string;
  orLabel?: string;
  keywordCall?: string;
  keywordArgs?: string;
  confidence: number;
  source: "keyword" | "test_object" | "flow" | "inline";
}

export interface GenerationPlan {
  projectId: string;
  mode: ProjectGenerationMode;
  bindings: StepBinding[];
  extraLocatorLines: string[];
  warnings: string[];
  suggestions: string[];
}
