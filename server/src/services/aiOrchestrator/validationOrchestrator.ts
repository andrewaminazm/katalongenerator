import { lintGroovy } from "../groovyLint.js";
import { validateKatalonGroovy } from "../katalonCompiler/validationLayer.js";
import { validateGroovyUtilityAst } from "../groovyGenerator/groovyAstValidator.js";
import type { LintIssue } from "../../types/index.js";
import type { TaskArtifact } from "./types.js";

const DANGEROUS_PATTERNS: { re: RegExp; message: string }[] = [
  { re: /\bRuntime\.getRuntime\(\)\.exec\b/, message: "Runtime.exec is not allowed" },
  { re: /\bProcessBuilder\b/, message: "ProcessBuilder is not allowed" },
  { re: /\bcurl\s+.*\|\s*sh\b/i, message: "Unsafe shell pipe pattern" },
  { re: /\brm\s+-rf\s+\/\b/, message: "Destructive shell command" },
  { re: /\b(password|api[_-]?key|secret)\s*=\s*['"][^'"]+['"]/i, message: "Hardcoded credential pattern" },
];

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  lint: LintIssue[];
}

export function validateArtifact(artifact: TaskArtifact): ValidationResult {
  const errors: string[] = [...artifact.validationErrors];
  const warnings: string[] = [...artifact.warnings];
  const lint: LintIssue[] = [];

  if (!artifact.code?.trim()) {
    errors.push("Empty generation output");
    return { ok: false, errors, warnings, lint };
  }

  for (const { re, message } of DANGEROUS_PATTERNS) {
    if (re.test(artifact.code)) {
      errors.push(`Security: ${message}`);
    }
  }

  const isUtility =
    artifact.generator !== "deterministicCompiler" &&
    artifact.generator !== "keywordGenerator";

  if (isUtility) {
    const ast = validateGroovyUtilityAst(artifact.code);
    errors.push(...ast.errors);
    warnings.push(...ast.warnings);
  } else {
    const v = validateKatalonGroovy(artifact.code);
    errors.push(...v.errors);
    warnings.push(...v.warnings);
  }

  const lintOut = lintGroovy(artifact.code, new Set(), {
    groovyUtility: isUtility,
    keywordTemplate: artifact.generator === "keywordGenerator",
  });
  lint.push(...lintOut);

  const dupImports = findDuplicateImports(artifact.code);
  if (dupImports.length) {
    warnings.push(`Duplicate imports: ${dupImports.join(", ")}`);
  }

  return { ok: errors.length === 0, errors, warnings, lint };
}

function findDuplicateImports(code: string): string[] {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const m of code.matchAll(/^import\s+([\w.]+)/gm)) {
    const imp = m[1]!;
    if (seen.has(imp)) dups.push(imp);
    seen.add(imp);
  }
  return dups;
}

export function validateAllArtifacts(artifacts: TaskArtifact[]): ValidationResult {
  const merged: ValidationResult = { ok: true, errors: [], warnings: [], lint: [] };
  for (const a of artifacts) {
    const r = validateArtifact(a);
    merged.errors.push(...r.errors);
    merged.warnings.push(...r.warnings);
    merged.lint.push(...r.lint);
    if (!r.ok) merged.ok = false;
  }
  return merged;
}
