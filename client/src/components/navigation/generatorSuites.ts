export type GeneratorTabId =
  | "manual"
  | "csv"
  | "jira"
  | "record"
  | "failure"
  | "api"
  | "performance";

export type GeneratorSuite = "input" | "api" | "performance" | "failure";

export const INPUT_SUITE_TABS: GeneratorTabId[] = ["manual", "csv", "jira", "record"];

export function suiteForTab(tab: string): GeneratorSuite {
  if (tab === "api") return "api";
  if (tab === "performance") return "performance";
  if (tab === "failure") return "failure";
  return "input";
}

export function isInputSuiteTab(tab: string): tab is GeneratorTabId {
  return (INPUT_SUITE_TABS as readonly string[]).includes(tab);
}

export function defaultTabForSuite(suite: GeneratorSuite): GeneratorTabId {
  switch (suite) {
    case "api":
      return "api";
    case "performance":
      return "performance";
    case "failure":
      return "failure";
    default:
      return "manual";
  }
}
