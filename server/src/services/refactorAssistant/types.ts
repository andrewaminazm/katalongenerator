export type RefactorSeverity = "low" | "medium" | "high" | "critical" | "info";
export type FixComplexity = "low" | "medium" | "high";

export interface RefactorAnalyzeOptions {
  projectId: string;
  forceRefresh?: boolean;
  maxScripts?: number;
}

export interface RefactorIssue {
  id: string;
  category:
    | "duplication"
    | "assertion"
    | "wait"
    | "or"
    | "keyword"
    | "architecture"
    | "structure"
    | "dead_code";
  severity: RefactorSeverity;
  confidence: number;
  impactScore: number;
  fixComplexity: FixComplexity;
  title: string;
  detail: string;
  whyItMatters: string;
  affectedFiles: string[];
  suggestedSolution: string;
  beforeExample?: string;
  afterExample?: string;
}

export interface RefactorRecommendation extends RefactorIssue {
  estimatedImpact: string;
  priority: number;
}

export interface DuplicateFlowFinding {
  pattern: string;
  scripts: string[];
  suggestedKeyword?: string;
  estimatedSavings: string;
}

export interface WeakAssertionFinding {
  scriptPath: string;
  logicalPath: string;
  reason: string;
  suggestion: string;
}

export interface OrProblemFinding {
  path: string;
  problem: string;
  recommendation: string;
}

export interface KeywordProblemFinding {
  path: string;
  className: string;
  problem: string;
  recommendation: string;
}

export interface ArchitectureInsight {
  id: string;
  area: string;
  insight: string;
  recommendation: string;
  severity: RefactorSeverity;
}

export interface RefactorAnalysisResult {
  projectId: string;
  projectName: string;
  analyzedAt: string;
  fromCache: boolean;
  maintainabilityScore: number;
  duplicationScore: number;
  frameworkHealthScore: number;
  assertionQualityScore: number;
  frameworkComplexityScore: number;
  orHealthScore: number;
  waitStabilityScore: number;
  issues: RefactorIssue[];
  recommendations: RefactorRecommendation[];
  duplicateFlows: DuplicateFlowFinding[];
  weakAssertions: WeakAssertionFinding[];
  orProblems: OrProblemFinding[];
  keywordProblems: KeywordProblemFinding[];
  architectureInsights: ArchitectureInsight[];
  duplicationHeatmap: Array<{ module: string; duplicationRisk: number; scriptCount: number }>;
}
