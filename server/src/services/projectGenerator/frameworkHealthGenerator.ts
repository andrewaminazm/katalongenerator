import type {
  GeneratedFile,
  GeneratedKeyword,
  GeneratedPageObject,
  FrameworkHealthReport,
} from "./types.js";

export function computeFrameworkHealth(input: {
  files: GeneratedFile[];
  pages: GeneratedPageObject[];
  keywords: GeneratedKeyword[];
  warnings: string[];
}): FrameworkHealthReport {
  const groovyFiles = input.files.filter(
    (f) => f.path.endsWith(".groovy") && f.content.length > 0
  );
  const orFiles = input.files.filter((f) => f.kind === "or");
  const hasHealingMeta = orFiles.filter((f) => f.content.includes("healingMeta")).length;
  const duplicateNames = new Set<string>();
  const seen = new Set<string>();
  for (const f of input.files) {
    const base = f.path.split("/").pop() ?? "";
    if (seen.has(base)) duplicateNames.add(base);
    seen.add(base);
  }

  const orQuality =
    orFiles.length === 0 ? 70 : Math.min(98, 75 + (hasHealingMeta / orFiles.length) * 20);
  const modularityScore = Math.min(
    95,
    60 + input.keywords.length * 3 + input.pages.length * 2
  );
  const assertionQuality = groovyFiles.some((f) => f.content.includes("verify"))
    ? 88
    : 72;
  const duplicationRisk = duplicateNames.size > 2 ? 35 : 12;
  const flakyRisk = input.warnings.filter((w) => /wait|flaky/i.test(w)).length * 8 + 10;
  const maintainabilityScore = Math.round(
    (orQuality + modularityScore + assertionQuality + (100 - duplicationRisk)) / 4
  );

  const findings: string[] = [];
  if (duplicateNames.size > 0) {
    findings.push(`${duplicateNames.size} duplicate file basename(s) detected — review naming.`);
  }
  if (orFiles.length > 0 && hasHealingMeta < orFiles.length) {
    findings.push("Some OR entries lack healing metadata — consider adding fallbacks.");
  }
  if (input.keywords.length < 4) {
    findings.push("Add more shared keywords to reduce script duplication.");
  }
  findings.push(...input.warnings.slice(0, 5));

  const overallScore = Math.round(
    (orQuality + assertionQuality + modularityScore + maintainabilityScore) / 4 -
      duplicationRisk * 0.1 -
      flakyRisk * 0.05
  );

  return {
    overallScore: Math.max(55, Math.min(98, overallScore)),
    orQuality: Math.round(orQuality),
    assertionQuality: Math.round(assertionQuality),
    modularityScore: Math.round(modularityScore),
    duplicationRisk: Math.round(duplicationRisk),
    flakyRisk: Math.round(flakyRisk),
    maintainabilityScore,
    findings,
  };
}
