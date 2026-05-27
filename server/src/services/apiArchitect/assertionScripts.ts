import type { EnrichedApiEndpoint } from "./types.js";
import { PERFORMANCE_MAX_MS } from "./constants.js";
import { postmanSchemaTestScript } from "./schemaFromExample.js";
import { inferSuccessStatus, statusAssertionPostman } from "./statusIntelligence.js";

function pmExpectNested(path: string): string[] {
  if (!path.includes(".")) {
    return [`pm.expect(json.${path}).to.exist;`];
  }
  const parts = path.split(".");
  const lines = ["let _v = json;"];
  for (const p of parts) {
    lines.push(`_v = _v && _v['${p}'];`);
  }
  lines.push("pm.expect(_v).to.exist;");
  return lines;
}

export function enterpriseHappyPathTests(ep: EnrichedApiEndpoint, saveVars: boolean): string[] {
  const lines: string[] = [];
  const success = inferSuccessStatus(ep);
  lines.push(...statusAssertionPostman([success]));

  lines.push(
    'pm.test("Response time acceptable", function () {',
    `    pm.expect(pm.response.responseTime).to.be.below(${PERFORMANCE_MAX_MS});`,
    "});"
  );

  if (ep.responseSchema) {
    lines.push(...postmanSchemaTestScript(ep.responseSchema));
  }

  for (const field of (ep.responseFields ?? []).slice(0, 8)) {
    const t = ep.fieldTypes?.[field] ?? "string";
    if (/token|access_token/i.test(field)) {
      lines.push(
        `pm.test("${field} is present and valid", function () {`,
        "    const json = pm.response.json();",
        `    pm.expect(json.${field}).to.exist;`,
        `    pm.expect(json.${field}).to.be.a('string');`,
        `    pm.expect(json.${field}.length).to.be.greaterThan(10);`,
        "});"
      );
      if (saveVars) {
        lines.push(
          'pm.test("Save auth token to environment", function () {',
          "    const json = pm.response.json();",
          `    const t = json.${field} || json.access_token;`,
          "    if (t) {",
          "        pm.environment.set('authToken', t);",
          "        pm.environment.set('token', t);",
          "    }",
          "});"
        );
      }
      continue;
    }

    if (t === "integer" || t === "number") {
      lines.push(
        `pm.test("${field} is numeric", function () {`,
        "    const json = pm.response.json();",
        `    pm.expect(json.${field}).to.be.a('number');`,
        "});"
      );
    } else if (t === "boolean") {
      lines.push(
        `pm.test("${field} is boolean", function () {`,
        "    const json = pm.response.json();",
        `    pm.expect(json.${field}).to.be.a('boolean');`,
        "});"
      );
    } else {
      lines.push(
        `pm.test("Response has ${field}", function () {`,
        "    const json = pm.response.json();",
        `    pm.expect(json).to.have.property('${field}');`,
        "});"
      );
    }
  }

  for (const nested of ep.nestedResponseFields.filter((p) => p.includes(".")).slice(0, 4)) {
    lines.push(
      `pm.test("Nested field ${nested} exists", function () {`,
      "    const json = pm.response.json();",
      ...pmExpectNested(nested).map((l) => `    ${l}`),
      "});"
    );
  }

  return lines;
}

export function enterpriseScenarioTests(expectedStatuses: number[]): string[] {
  const lines = [...statusAssertionPostman(expectedStatuses)];
  lines.push(
    'pm.test("Response time recorded", function () {',
    "    pm.expect(pm.response.responseTime).to.be.a('number');",
    "});"
  );
  return lines;
}

export function saveVarScripts(vars: { envKey: string; jsonPath: string }[]): string[] {
  const lines: string[] = [];
  for (const v of vars) {
    if (!v.jsonPath.includes(".")) {
      lines.push(`if (json.${v.jsonPath}) pm.environment.set('${v.envKey}', json.${v.jsonPath});`);
    } else {
      const parts = v.jsonPath.split(".");
      lines.push("let _save = json;");
      for (const p of parts) {
        lines.push(`_save = _save && _save['${p}'];`);
      }
      lines.push(`if (_save) pm.environment.set('${v.envKey}', _save);`);
    }
  }
  return lines;
}

export function postTestSaveVarsBlock(scenario: { saveVars?: { envKey: string; jsonPath: string }[] }): string[] {
  if (!scenario.saveVars?.length) return [];
  return [
    "",
    "// Persist IDs for chained requests",
    "const json = pm.response.json();",
    ...saveVarScripts(scenario.saveVars),
  ];
}

export function standardPrerequestScripts(): string[] {
  return [
    "pm.environment.set('requestId', pm.variables.replaceIn('{{$guid}}'));",
    "pm.environment.set('correlationId', pm.variables.replaceIn('{{$guid}}'));",
    "pm.environment.set('timestamp', new Date().toISOString());",
  ];
}
