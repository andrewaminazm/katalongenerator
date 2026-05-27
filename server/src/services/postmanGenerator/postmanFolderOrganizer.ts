import type { AuthType } from "../apiCodeGenerator/types.js";
import {
  allScenariosForEndpoint,
  generateBoundaryScenarios,
  generateNegativeScenarios,
  generateSecurityScenarios,
} from "../apiArchitect/scenarioGenerator.js";
import { groupBySemanticModule } from "../apiArchitect/semanticClassifier.js";
import type { EnrichedApiEndpoint } from "../apiArchitect/types.js";
import { buildRequestItem } from "./postmanRequestGenerator.js";
import {
  aiMetadataComment,
  postTestSaveVars,
  prerequestForScenario,
  scenarioTests,
  testEvent,
} from "./postmanTestScriptGenerator.js";
import type { ApiTestScenario } from "../apiArchitect/types.js";
import { enterpriseHappyPathTests } from "../apiArchitect/assertionScripts.js";

function buildScenarioItem(
  ep: EnrichedApiEndpoint,
  scenario: ApiTestScenario,
  globalAuth: AuthType,
  loginSaveDone: { value: boolean }
): Record<string, unknown> {
  const saveToken =
    !loginSaveDone.value &&
    scenario.testType === "happy" &&
    (/login|auth|token/i.test(ep.path) || ep.producesVars.some((v) => /token/i.test(v.envKey)));

  if (saveToken) loginSaveDone.value = true;

  const testLines = [
    `// ${aiMetadataComment(scenario)}`,
    ...(scenario.testType === "happy"
      ? enterpriseHappyPathTests(ep, saveToken)
      : scenarioTests(scenario)),
    ...postTestSaveVars(scenario),
  ];

  const pre = prerequestForScenario(ep, scenario, globalAuth);

  return buildRequestItem({
    name: scenario.title,
    ep,
    pathOverride: scenario.pathOverride,
    bodyOverride: scenario.bodyOverride,
    rawBody: scenario.rawBody,
    expectedStatuses: scenario.expectedStatuses,
    testScripts: testLines,
    prerequestScripts: pre,
    globalAuth,
    skipAuth: scenario.skipAuth,
    useInvalidToken: scenario.useInvalidToken,
    saveToken,
    aiMetadata: scenario,
  });
}

export function buildHappyPathFolders(
  endpoints: EnrichedApiEndpoint[],
  globalAuth: AuthType,
  generatedTests: string[]
): Record<string, unknown>[] {
  const folders: Record<string, unknown>[] = [];
  const groups = groupBySemanticModule(endpoints);
  const loginSaveDone = { value: false };

  const order = [
    "Authentication",
    "Users",
    "Orders",
    "Products",
    "Inventory",
    "Payments",
    "Admin",
    "Reports",
    "API",
  ];

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  for (const folderName of sortedKeys) {
    const eps = groups.get(folderName)!;
    const items: Record<string, unknown>[] = [];

    for (const ep of eps as EnrichedApiEndpoint[]) {
      const happy = allScenariosForEndpoint(ep, {
        includeNegative: false,
        includeBoundary: false,
        includeSecurity: false,
      })[0];
      if (!happy) continue;
      items.push(buildScenarioItem(ep, happy, globalAuth, loginSaveDone));
      generatedTests.push(`${folderName} / ${happy.title}`);
    }

    if (items.length) folders.push({ name: folderName, item: items });
  }

  return folders;
}

function buildScenarioFolder(
  name: string,
  endpoints: EnrichedApiEndpoint[],
  scenariosFn: (ep: EnrichedApiEndpoint) => ApiTestScenario[],
  globalAuth: AuthType,
  generatedTests: string[]
): Record<string, unknown> | null {
  const moduleGroups = groupBySemanticModule(endpoints);
  const subfolders: Record<string, unknown>[] = [];

  for (const [moduleName, eps] of moduleGroups) {
    const items: Record<string, unknown>[] = [];
    const loginSaveDone = { value: true };

    for (const ep of eps as EnrichedApiEndpoint[]) {
      for (const scenario of scenariosFn(ep)) {
        items.push(buildScenarioItem(ep, scenario, globalAuth, loginSaveDone));
        generatedTests.push(`${name} / ${moduleName} / ${scenario.title}`);
      }
    }
    if (items.length) subfolders.push({ name: moduleName, item: items });
  }

  if (!subfolders.length) return null;
  return { name, item: subfolders };
}

export function buildNegativeFolder(
  endpoints: EnrichedApiEndpoint[],
  globalAuth: AuthType,
  generatedTests: string[]
): Record<string, unknown> | null {
  return buildScenarioFolder(
    "Negative Tests",
    endpoints,
    generateNegativeScenarios,
    globalAuth,
    generatedTests
  );
}

export function buildBoundaryFolder(
  endpoints: EnrichedApiEndpoint[],
  globalAuth: AuthType,
  generatedTests: string[]
): Record<string, unknown> | null {
  return buildScenarioFolder(
    "Boundary Tests",
    endpoints,
    generateBoundaryScenarios,
    globalAuth,
    generatedTests
  );
}

export function buildSecurityFolder(
  endpoints: EnrichedApiEndpoint[],
  globalAuth: AuthType,
  generatedTests: string[]
): Record<string, unknown> | null {
  return buildScenarioFolder(
    "Security Tests",
    endpoints,
    generateSecurityScenarios,
    globalAuth,
    generatedTests
  );
}
