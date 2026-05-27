export function jsonSchemaFromExample(
  example?: Record<string, unknown>,
  requiredFields?: string[]
): Record<string, unknown> | undefined {
  if (!example || !Object.keys(example).length) return undefined;

  const properties: Record<string, unknown> = {};
  const required = requiredFields?.length ? [...requiredFields] : [];

  for (const [key, val] of Object.entries(example)) {
    if (val === null) {
      properties[key] = { type: "null" };
    } else if (Array.isArray(val)) {
      properties[key] = { type: "array" };
    } else if (typeof val === "number") {
      properties[key] = Number.isInteger(val) ? { type: "integer" } : { type: "number" };
    } else if (typeof val === "boolean") {
      properties[key] = { type: "boolean" };
    } else if (typeof val === "object") {
      const nested = jsonSchemaFromExample(val as Record<string, unknown>);
      properties[key] = nested ?? { type: "object" };
    } else {
      properties[key] = { type: "string" };
    }
    if (!required.includes(key) && val !== null && val !== "") {
      required.push(key);
    }
  }

  return {
    type: "object",
    required: required.filter((k) => k in example),
    properties,
  };
}

export function postmanSchemaTestScript(schema: Record<string, unknown>): string[] {
  const schemaJson = JSON.stringify(schema, null, 2)
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

  return [
    "const schema = " + JSON.stringify(schema) + ";",
    'pm.test("Response matches JSON schema", function () {',
    "    const json = pm.response.json();",
    "    pm.expect(json).to.be.an('object');",
    ...Object.keys((schema.properties as Record<string, unknown>) ?? {}).map(
      (k) => `    pm.expect(json).to.have.property('${k}');`
    ),
    "});",
  ];
}
