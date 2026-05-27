import type { ArchitecturePattern, FrameworkKind, ProjectGeneratorTemplate } from "./types.js";

export const PROJECT_TEMPLATES: ProjectGeneratorTemplate[] = [
  {
    id: "hybrid-layered",
    name: "Hybrid Layered Enterprise",
    description: "UI + API + utilities with layered pages, keywords, and shared services.",
    frameworkKind: "hybrid",
    architecturePattern: "layered",
    defaultModules: ["Auth", "Catalog", "Checkout", "API", "Reporting"],
  },
  {
    id: "ui-pom",
    name: "Web UI Page Object Model",
    description: "Classic POM with page objects, OR-backed locators, and smoke/regression suites.",
    frameworkKind: "ui",
    architecturePattern: "page-object",
    defaultModules: ["Login", "Dashboard", "Search"],
  },
  {
    id: "api-microservice",
    name: "API Microservice Framework",
    description: "REST clients, schema validation, auth managers, and API regression suites.",
    frameworkKind: "api",
    architecturePattern: "microservice-api",
    defaultModules: ["Auth", "Orders", "Payments"],
  },
  {
    id: "mobile-appium",
    name: "Mobile Appium Framework",
    description: "Mobile page objects, gesture helpers, and device-aware utilities.",
    frameworkKind: "mobile",
    architecturePattern: "hybrid",
    defaultModules: ["Onboarding", "Home", "Settings"],
  },
  {
    id: "perf-jmeter-k6",
    name: "Performance (JMeter + k6)",
    description: "Load profiles, SLA utilities, and performance suite scaffolding.",
    frameworkKind: "performance",
    architecturePattern: "layered",
    defaultModules: ["Smoke", "Baseline", "Stress"],
  },
];

export function getTemplate(id: string): ProjectGeneratorTemplate | undefined {
  return PROJECT_TEMPLATES.find((t) => t.id === id);
}

export function defaultModulesFor(
  kind: FrameworkKind,
  pattern: ArchitecturePattern
): string[] {
  const hit = PROJECT_TEMPLATES.find(
    (t) => t.frameworkKind === kind && t.architecturePattern === pattern
  );
  if (hit) return [...hit.defaultModules];
  if (kind === "api") return ["Auth", "Core API"];
  if (kind === "mobile") return ["Onboarding", "Core"];
  if (kind === "performance") return ["Smoke", "Load"];
  return ["Core", "Regression"];
}
