import type { ApiEndpointSpec } from "./types.js";
import { jsonSchemaFromExample } from "../apiArchitect/schemaFromExample.js";

export function generateSchemaAssertions(endpoint: ApiEndpointSpec): string[] {
  const fields =
    endpoint.responseFields?.length
      ? endpoint.responseFields
      : endpoint.responseExample
        ? Object.keys(endpoint.responseExample)
        : [];

  if (!fields.length) return [];

  const fieldList = fields
    .slice(0, 12)
    .map((f) => `'${f}'`)
    .join(", ");

  const lines: string[] = [
    `ResponseValidator.validateRequiredFields(response, [${fieldList}])`,
  ];

  for (const field of fields.slice(0, 8)) {
    const t = endpoint.fieldTypes?.[field];
    if (t === "integer" || t === "number") {
      lines.push(`ResponseValidator.validateFieldType(response, '${field}', Number)`);
    } else if (t === "boolean") {
      lines.push(`ResponseValidator.validateFieldType(response, '${field}', Boolean)`);
    } else if (/token|access_token/i.test(field)) {
      lines.push(
        `def ${field}Val = response.getPropertyValue('${field}')`,
        `assert ${field}Val && ${field}Val.toString().length() > 10 : 'Token must be a non-empty string'`
      );
    } else {
      lines.push(
        `assert response.getPropertyValue('${field}') != null : 'Missing field ${field}'`
      );
    }
  }

  const nested = (endpoint as { nestedResponseFields?: string[] }).nestedResponseFields ?? [];
  for (const path of nested.filter((p) => p.includes(".")).slice(0, 4)) {
    const top = path.split(".")[0];
    lines.push(`// Nested contract: ${path} (validate via top-level '${top}')`);
  }

  if (endpoint.responseExample && jsonSchemaFromExample(endpoint.responseExample, endpoint.requiredFields)) {
    lines.push("// Schema contract inferred from response example — extend with JSON Schema validator if needed");
  }

  lines.push(`ResponseValidator.assertResponseTime(response, 2000)`);
  return lines;
}

export function schemaAssertionSummary(endpoints: ApiEndpointSpec[]): string[] {
  const all: string[] = [];
  for (const ep of endpoints) {
    const fields = ep.responseFields?.length
      ? ep.responseFields
      : ep.responseExample
        ? Object.keys(ep.responseExample)
        : [];
    for (const f of fields.slice(0, 8)) {
      all.push(`validateRequiredFields: ${ep.name}.${f}`);
    }
  }
  return all;
}
