import type { EnrichedApiEndpoint } from "../apiArchitect/types.js";
import { classifyEndpoints } from "./apiClassifier.js";
import { generateJmeterPlan } from "./jmeterGenerator.js";
import { generateK6Script } from "./k6Generator.js";
import { resolvePerformanceInput } from "./inputResolver.js";
import { buildLoadModel } from "./loadModel.js";
import { buildStrategyReport } from "./strategyReport.js";
import type { PerformanceGenerateRequest, PerformanceGenerateResult } from "./types.js";

export * from "./types.js";

const DEFAULT_CONFIG = {
  vus: 10,
  duration: "5m",
  rampUp: "30s",
  environment: "qa" as const,
};

export async function generatePerformanceSuite(
  req: PerformanceGenerateRequest
): Promise<PerformanceGenerateResult> {
  const resolved = await resolvePerformanceInput(req);
  const classified = classifyEndpoints(resolved.endpoints as EnrichedApiEndpoint[]);
  const mode = req.mode ?? "baseline";
  const config = { ...DEFAULT_CONFIG, ...req.config };
  const loadModel = buildLoadModel(mode, config, classified);
  const strategy = buildStrategyReport(classified, loadModel, mode, resolved.baseUrl);

  const wantJmeter = !req.output?.length || req.output.includes("jmeter");
  const wantK6 = !req.output?.length || req.output.includes("k6");

  const jmeter = wantJmeter
    ? generateJmeterPlan(resolved.suiteName, resolved.baseUrl, classified, loadModel)
    : "";
  const k6 = wantK6
    ? generateK6Script(resolved.suiteName, resolved.baseUrl, classified, loadModel)
    : "";

  const warnings = [...resolved.warnings];
  if (classified.some((e) => e.loadCategory === "payment")) {
    warnings.push("Payment endpoints detected — keep VUs low and monitor error budgets.");
  }
  if (classified.some((e) => e.critical)) {
    warnings.push("Critical auth/payment APIs included — validate correlation before full load.");
  }

  return {
    jmeter,
    k6,
    strategy,
    warnings,
    baseUrl: resolved.baseUrl,
    endpointCount: classified.length,
  };
}
