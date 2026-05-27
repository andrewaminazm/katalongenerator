import type {
  ArchitecturePattern,
  DomainHint,
  FrameworkKind,
  ProjectGeneratorInput,
  ProjectSize,
} from "./types.js";
import { defaultModulesFor } from "./templates.js";

export interface ArchitecturePlan {
  projectName: string;
  frameworkKind: FrameworkKind;
  architecturePattern: ArchitecturePattern;
  domain: DomainHint;
  projectSize: ProjectSize;
  modules: string[];
  flows: string[];
  layers: string[];
  includeApi: boolean;
  includeUi: boolean;
  includeMobile: boolean;
  includePerformance: boolean;
  includeBdd: boolean;
  includeReporting: boolean;
  namingPrefix: string;
}

const DOMAIN_FLOWS: Record<DomainHint, string[]> = {
  ecommerce: ["Login → Search → Add to Cart → Checkout", "Guest checkout", "Order history"],
  banking: ["Login → Transfer funds", "View statements", "Pay bill"],
  healthcare: ["Patient login → Book appointment", "View records"],
  saas: ["Sign up → Onboard → Create workspace", "Invite user"],
  government: ["Citizen login → Submit form", "Track application"],
  generic: ["Login → Core workflow", "Smoke validation"],
};

function inferModulesFromDescription(desc: string, fallback: string[]): string[] {
  const lower = desc.toLowerCase();
  const candidates = [
    "Login",
    "Dashboard",
    "Search",
    "Checkout",
    "Profile",
    "Admin",
    "Reports",
    "API",
    "Payments",
    "Catalog",
  ];
  const found = candidates.filter((m) => lower.includes(m.toLowerCase()));
  return found.length > 0 ? found : fallback;
}

function sizeMultiplier(size: ProjectSize): number {
  if (size === "starter") return 1;
  if (size === "enterprise") return 3;
  return 2;
}

export function buildArchitecturePlan(input: ProjectGeneratorInput): ArchitecturePlan {
  const fallbackModules =
    input.modules.length > 0
      ? input.modules
      : defaultModulesFor(input.frameworkKind, input.architecturePattern);

  const modules =
    input.description.trim().length > 20
      ? inferModulesFromDescription(input.description, fallbackModules)
      : fallbackModules;

  const scaled =
    sizeMultiplier(input.projectSize) > 1
      ? [
          ...modules,
          ...modules
            .filter((m) => !m.toLowerCase().includes("api"))
            .map((m) => `${m}Extended`),
        ].slice(0, modules.length * sizeMultiplier(input.projectSize))
      : modules;

  const flows =
    input.businessFlows.length > 0
      ? input.businessFlows
      : DOMAIN_FLOWS[input.domain] ?? DOMAIN_FLOWS.generic;

  const kind = input.frameworkKind;
  const includeUi = kind === "ui" || kind === "hybrid";
  const includeApi =
    kind === "api" || kind === "hybrid" || Boolean(input.swaggerText || input.postmanText);
  const includeMobile = kind === "mobile" || kind === "hybrid" || input.includeMobile;
  const includePerformance =
    kind === "performance" || kind === "hybrid" || input.includePerformance;

  const layers: string[] = ["utils", "keywords"];
  if (includeUi) layers.push("pages", "or");
  if (includeApi) layers.push("api");
  if (includeMobile) layers.push("mobile");
  if (includePerformance) layers.push("performance");
  if (input.includeBdd) layers.push("bdd");
  layers.push("scripts", "suites", "docs", "ai");

  const safeName = input.projectName.replace(/[^a-zA-Z0-9]/g, "");
  const namingPrefix = safeName ? safeName.slice(0, 3).toUpperCase() : "ENT";

  return {
    projectName: input.projectName.trim() || "EnterpriseAutomation",
    frameworkKind: kind,
    architecturePattern: input.architecturePattern,
    domain: input.domain,
    projectSize: input.projectSize,
    modules: scaled,
    flows,
    layers,
    includeApi,
    includeUi,
    includeMobile,
    includePerformance,
    includeBdd: input.includeBdd,
    includeReporting: input.includeReporting,
    namingPrefix,
  };
}

export function architectureSummary(plan: ArchitecturePlan): string {
  const parts = [
    `${plan.frameworkKind.toUpperCase()} framework`,
    `pattern: ${plan.architecturePattern}`,
    `domain: ${plan.domain}`,
    `modules: ${plan.modules.join(", ")}`,
    `layers: ${plan.layers.join(" → ")}`,
  ];
  return parts.join(" · ");
}
