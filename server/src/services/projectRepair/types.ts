export type RepairMode = "preview" | "suggest" | "assisted" | "full_plan";

export type RepairCategory =
  | "script"
  | "locator"
  | "or"
  | "framework"
  | "api"
  | "mobile"
  | "performance"
  | "assertion"
  | "wait"
  | "duplicate"
  | "import"
  | "dependency"
  | "suite"
  | "naming"
  | "architecture";

export type RepairSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface RepairAnalyzeOptions {
  projectId: string;
  forceRefresh?: boolean;
  maxScripts?: number;
}

export interface RepairExecuteOptions {
  projectId: string;
  repairId: string;
  mode?: RepairMode;
  /** Apply only these suggestion ids; empty = all auto-applicable */
  suggestionIds?: string[];
}

export interface RepairSuggestion {
  id: string;
  category: RepairCategory;
  severity: RepairSeverity;
  confidence: number;
  priority: number;
  title: string;
  detail: string;
  whyItMatters: string;
  affectedFiles: string[];
  suggestedFix: string;
  autoApplicable: boolean;
  beforeExample?: string;
  afterExample?: string;
}

export interface LocatorRepairItem {
  orPath: string;
  label: string;
  problem: string;
  oldLocator: { type: string; value: string };
  newLocator?: { type: string; value: string };
  confidence: number;
  healingMetadata?: { fallbacks: string[]; score: number };
}

export interface RepairDiff {
  filePath: string;
  category: RepairCategory;
  suggestionId: string;
  original: string;
  repaired: string;
  diffSummary: string[];
  changed: boolean;
  lintPassed: boolean;
  lintWarnings: string[];
}

export interface RiskArea {
  module: string;
  riskScore: number;
  reasons: string[];
  repairPriority: number;
}

export interface FrameworkHealthScores {
  maintainabilityScore: number;
  locatorQualityScore: number;
  assertionQualityScore: number;
  architectureQualityScore: number;
  flakinessScore: number;
  duplicationScore: number;
  scalabilityScore: number;
  overallHealthScore: number;
}

export interface ProjectRepairAnalysisResult {
  repairId: string;
  projectId: string;
  projectName: string;
  analyzedAt: string;
  fromCache: boolean;
  healthScore: number;
  flakinessScore: number;
  frameworkHealth: FrameworkHealthScores;
  repairSuggestions: RepairSuggestion[];
  locatorRepairs: LocatorRepairItem[];
  duplicateFlows: { pattern: string; scripts: string[]; suggestedKeyword?: string }[];
  architectureWarnings: { area: string; warning: string; recommendation: string }[];
  riskAreas: RiskArea[];
  dependencyIssues: { kind: string; from: string; to: string; message: string }[];
  repairDiffs: RepairDiff[];
  repairedFiles: RepairDiff[];
  rollbackAvailable: boolean;
  rollbackId?: string;
  downloadableZip?: string;
  warnings: string[];
  mode: RepairMode;
}

export interface RollbackSnapshot {
  rollbackId: string;
  repairId: string;
  projectId: string;
  createdAt: string;
  files: Array<{ filePath: string; original: string }>;
}
