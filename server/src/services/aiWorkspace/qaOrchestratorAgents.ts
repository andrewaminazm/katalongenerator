import type { WorkspaceIntent } from "./types.js";
import type { RoutedIntent } from "./intentRouter.js";

export type QaOrchestratorAgentId =
  | "test_architect"
  | "automation"
  | "api_qa"
  | "performance_qa"
  | "coverage"
  | "failure_analysis"
  | "repair"
  | "flaky"
  | "release_risk"
  | "security_quality";

export const QA_AGENT_LABELS: Record<QaOrchestratorAgentId, string> = {
  test_architect: "Test Architect Agent",
  automation: "Automation Agent",
  api_qa: "API QA Agent",
  performance_qa: "Performance QA Agent",
  coverage: "Coverage Analysis Agent",
  failure_analysis: "Failure Analysis Agent",
  repair: "Repair Agent",
  flaky: "Flaky Test Detection Agent",
  release_risk: "Release Risk Agent",
  security_quality: "QA Quality & Security Agent",
};

/** Select which specialized agents the QA Director should simulate (not all on every request). */
export function selectQaAgentsForRequest(
  route: RoutedIntent,
  message: string
): QaOrchestratorAgentId[] {
  const lower = message.toLowerCase();
  const agents = new Set<QaOrchestratorAgentId>();

  const add = (...ids: QaOrchestratorAgentId[]) => ids.forEach((id) => agents.add(id));

  switch (route.intent) {
    case "generate":
      add("test_architect", "automation");
      if (/\b(api|rest|swagger|postman|token|endpoint)\b/i.test(lower)) add("api_qa");
      if (/\b(load|stress|k6|jmeter|performance|throughput)\b/i.test(lower)) add("performance_qa");
      break;
    case "analyze":
      add("coverage", "flaky", "security_quality", "release_risk");
      if (/\b(heal|locator|broken|fix)\b/i.test(lower)) add("repair");
      break;
    case "api":
      add("api_qa", "test_architect");
      break;
    case "performance":
      add("performance_qa", "api_qa", "release_risk");
      break;
    case "heal":
      add("failure_analysis", "repair", "flaky", "automation");
      break;
    case "explain":
      add("failure_analysis", "repair", "flaky", "test_architect");
      if (/\b(fail|error|broken|flaky|log)\b/i.test(lower)) {
        add("failure_analysis", "repair", "flaky");
      }
      break;
    case "review":
    case "optimize":
      add("security_quality", "coverage", "test_architect", "repair");
      break;
    case "document":
      add("test_architect", "coverage");
      break;
    case "convert":
      add("api_qa", "test_architect", "automation");
      break;
    default:
      add("test_architect");
      if (/\b(fail|error|broken|flaky)\b/i.test(lower)) {
        add("failure_analysis", "repair", "flaky");
      }
      if (/\b(release|ready|deploy|ci)\b/i.test(lower)) add("release_risk");
  }

  if (/\b(fail|failed|error|broken|stack|log)\b/i.test(lower) && route.intent !== "generate") {
    add("failure_analysis", "repair");
  }
  if (/\b(flaky|intermittent|unstable)\b/i.test(lower)) add("flaky");
  if (/\b(security|xss|injection|auth)\b/i.test(lower)) add("security_quality");

  if (agents.size === 0) add("test_architect");

  return [...agents];
}

export function formatAgentActivationBlock(
  agents: QaOrchestratorAgentId[],
  intent: WorkspaceIntent,
  confidence: number
): string {
  const labels = agents.map((id) => QA_AGENT_LABELS[id]).join(", ");
  return `## Orchestration (internal)
**Detected Intent:** ${intent} · **Confidence:** ${Math.round(confidence * 100)}%
**Agents to simulate this turn:** ${labels}
Simulate only these agents in parallel, then merge as QA Director. Do not duplicate work across agents.`;
}

export function backendAgentsInvoked(opts: {
  projectAnalysis?: boolean;
  performanceSuite?: boolean;
  groovyCompiled?: boolean;
}): string {
  const lines: string[] = [];
  if (opts.projectAnalysis) {
    lines.push(
      "- **Backend invoked:** Project Intelligence v2 analyze (feeds Coverage, Flaky, Repair, Release Risk agents with real project data)."
    );
  }
  if (opts.performanceSuite) {
    lines.push(
      "- **Backend invoked:** Performance engine (feeds Performance QA Agent with strategy/k6 artifacts)."
    );
  }
  if (opts.groovyCompiled) {
    lines.push(
      "- **Backend invoked:** Deterministic Katalon compiler (Automation Agent artifact attached below — reference it in section 6, do not duplicate full Groovy in prose)."
    );
  }
  return lines.length ? lines.join("\n") : "";
}
