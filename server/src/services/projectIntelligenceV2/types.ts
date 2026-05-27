import type { ProjectIndex, ProjectKnowledgeGraphData } from "../projectIntelligence/types.js";

export type InsightSeverity = "critical" | "warning" | "info";

export interface FixExplanation {
  severity: InsightSeverity;
  confidence: number;
  reason: string;
  ruleId: string;
}

export interface TestCaseFix {
  scriptPath: string;
  logicalPath: string;
  original: string;
  fixed: string;
  diffSummary: string[];
  explanations: FixExplanation[];
  changed: boolean;
}

export interface ObjectRepositoryFix {
  orPath: string;
  label: string;
  oldLocator: { type: string; value: string };
  newLocator: { type: string; value: string };
  confidence: number;
  reason: string;
  severity: InsightSeverity;
  impactedScripts: string[];
}

export interface KeywordFix {
  filePath: string;
  className: string;
  issue: string;
  suggestion: string;
  severity: InsightSeverity;
  confidence: number;
}

export interface ProjectGraphV2 extends ProjectKnowledgeGraphData {
  suites: { id: string; path: string }[];
  apis: { id: string; path: string }[];
  reverseEdges: {
    testObjectUsedBy: Record<string, string[]>;
    keywordUsedBy: Record<string, string[]>;
  };
  orphans: {
    testObjects: string[];
    keywords: string[];
    testScripts: string[];
  };
  duplicates: {
    testObjects: { selector: string; paths: string[] }[];
    flows: { pattern: string; scripts: string[] }[];
  };
}

export interface FlakyTestInsight {
  scriptPath: string;
  logicalPath: string;
  riskScore: number;
  reasons: string[];
  severity: InsightSeverity;
}

export interface UnusedAssetInsight {
  kind: "test_object" | "keyword" | "test_script";
  id: string;
  label: string;
  reason: string;
}

export interface ProjectInsights {
  flakyTests: FlakyTestInsight[];
  unusedAssets: UnusedAssetInsight[];
  riskScore: number;
  refactoringHints: string[];
  styleProfile: string[];
}

export interface DocumentationSections {
  overview: string;
  coverageMap: string;
  objectRepositoryGuide: string;
  keywordLibraryGuide: string;
  testExecutionGuide: string;
  flakyRiskReport: string;
}

export interface ProjectIntelligenceV2Result {
  projectId: string;
  projectName: string;
  analyzedAt: string;
  fixes: {
    testCases: TestCaseFix[];
    objectRepository: ObjectRepositoryFix[];
    keywords: KeywordFix[];
  };
  documentation: {
    markdown: string;
    sections: DocumentationSections;
  };
  projectGraph: ProjectGraphV2;
  insights: ProjectInsights;
  warnings: string[];
}

export interface AnalyzeProjectV2Options {
  healScripts?: boolean;
  healLocators?: boolean;
  generateDocumentation?: boolean;
  includeGraph?: boolean;
  maxScripts?: number;
}

export interface ScriptIssue {
  ruleId: string;
  severity: InsightSeverity;
  message: string;
  line?: number;
  confidence: number;
}
