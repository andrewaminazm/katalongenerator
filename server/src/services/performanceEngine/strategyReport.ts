import type { ClassifiedEndpoint, LoadModel, PerformanceMode, PerformanceScenario, StrategyReport } from "./types.js";

function groupClassified(endpoints: ClassifiedEndpoint[]): Map<string, ClassifiedEndpoint[]> {
  const groups = new Map<string, ClassifiedEndpoint[]>();
  for (const ep of endpoints) {
    const mod = ep.semanticModule ?? "General";
    const list = groups.get(mod) ?? [];
    list.push(ep);
    groups.set(mod, list);
  }
  return groups;
}

export function buildStrategyReport(
  endpoints: ClassifiedEndpoint[],
  loadModel: LoadModel,
  mode: PerformanceMode,
  baseUrl: string
): StrategyReport {
  const scenarios: PerformanceScenario[] = [];
  const groups = groupClassified(endpoints);

  for (const [moduleName, eps] of groups) {
    const category = eps[0]?.loadCategory ?? "default";
    const vus = Math.max(1, Math.round(loadModel.totalVus * (eps.length / Math.max(endpoints.length, 1))));
    scenarios.push({
      id: `scenario-${moduleName.toLowerCase().replace(/\s+/g, "-")}`,
      name: `${moduleName} — ${mode}`,
      module: moduleName,
      endpoints: eps.map((e) => `${e.method} ${e.path}`),
      vus,
      duration: loadModel.duration,
      rampUp: loadModel.rampUp,
      description: `${category} workload for ${moduleName} (${eps.length} endpoint(s))`,
    });
  }

  const riskAnalysis: string[] = [];
  const bottleneckHints: string[] = [];
  const dependencyRisks: string[] = [];
  const slaRecommendations: string[] = [];

  if (endpoints.some((e) => e.loadCategory === "auth")) {
    dependencyRisks.push("Auth endpoints must succeed before load scenarios — run login once in setup / Thread Group.");
    slaRecommendations.push("Auth: p95 < 800ms, error rate < 0.1%");
  }
  if (endpoints.some((e) => e.loadCategory === "payment")) {
    riskAnalysis.push("Payment APIs under load may trigger rate limits — cap VUs and use controlled throughput.");
    slaRecommendations.push("Payments: p95 < 1500ms, error rate < 0.01%");
  }
  if (endpoints.some((e) => e.loadCategory === "write")) {
    bottleneckHints.push("Write endpoints (POST/PUT/PATCH) often become DB-bound — monitor connection pool saturation.");
  }
  if (endpoints.some((e) => e.loadCategory === "search")) {
    bottleneckHints.push("Search/list endpoints may need caching or read replicas at high concurrency.");
  }
  if (mode === "spike") {
    riskAnalysis.push("Spike mode validates autoscaling and circuit breakers — watch 5xx during ramp.");
  }
  if (mode === "soak") {
    riskAnalysis.push("Soak mode exposes memory leaks and connection churn — monitor heap and DB connections.");
  }

  slaRecommendations.push(
    `General: http_req_duration p(95) < 2000ms on ${baseUrl}`,
    "Error rate < 1% for non-auth scenarios"
  );

  return {
    scenarios,
    loadModel,
    riskAnalysis,
    slaRecommendations,
    bottleneckHints,
    dependencyRisks,
  };
}
