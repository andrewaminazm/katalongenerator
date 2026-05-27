/** Groovy emission helpers for Katalon API tests */

export function sanitizeIdentifier(raw: string): string {
  const s = raw.replace(/[^a-zA-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  return s || "field";
}

export function endpointVarPrefix(endpointName: string): string {
  const p = sanitizeIdentifier(endpointName);
  return p.charAt(0).toLowerCase() + p.slice(1);
}

export class UniqueVarNames {
  private used = new Set<string>();

  constructor(private scope: string) {}

  private suffixPart(suffix: string): string {
    const cleaned = sanitizeIdentifier(suffix);
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  response(suffix: string): string {
    const base = `response${this.scope}${this.suffixPart(suffix)}`;
    let name = base;
    let i = 2;
    while (this.used.has(name)) {
      name = `${base}${i}`;
      i++;
    }
    this.used.add(name);
    return name;
  }

  payload(suffix: string): string {
    const base = `payload${this.scope}${this.suffixPart(suffix)}`;
    let name = base;
    let i = 2;
    while (this.used.has(name)) {
      name = `${base}${i}`;
      i++;
    }
    this.used.add(name);
    return name;
  }

  request(suffix: string): string {
    const base = `request${this.scope}${this.suffixPart(suffix)}`;
    let name = base;
    let i = 2;
    while (this.used.has(name)) {
      name = `${base}${i}`;
      i++;
    }
    this.used.add(name);
    return name;
  }
}

export function emitGroovyMapValue(value: unknown, key?: string): string {
  if (value === null) return "null";
  if (value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (key && /pass|secret|token|key/i.test(key)) {
      return `'${value.replace(/'/g, "\\'")}'`;
    }
    return `'${value.replace(/'/g, "\\'")}'`;
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => emitGroovyMapValue(v)).join(", ")}]`;
  }
  if (typeof value === "object") {
    return emitGroovyMapLiteral(value as Record<string, unknown>);
  }
  return `'${String(value).replace(/'/g, "\\'")}'`;
}

export function emitGroovyMapLiteral(obj: Record<string, unknown>): string {
  const entries = Object.entries(obj).map(([k, v]) => `    ${k}: ${emitGroovyMapValue(v, k)}`);
  return `[\n${entries.join(",\n")}\n]`;
}

/** Override specific fields with raw Groovy expressions (e.g. 'A' * 5000) */
export function emitGroovyMapLiteralWithOverrides(
  obj: Record<string, unknown>,
  overrides: Record<string, string>
): string {
  const entries = Object.entries(obj).map(([k, v]) => {
    const expr = overrides[k] ?? emitGroovyMapValue(v, k);
    return `    ${k}: ${expr}`;
  });
  return `[\n${entries.join(",\n")}\n]`;
}

/** Groovy expression for oversized string boundary */
export function emitOversizedString(length: number): string {
  return `'A' * ${length}`;
}

export interface PayloadSendBlock {
  lines: string[];
  responseVar: string;
  title: string;
}

export function emitPayloadSendBlock(opts: {
  vars: UniqueVarNames;
  requestPath: string;
  payload: Record<string, unknown>;
  scenarioSuffix: string;
  expectedStatus: number;
  title: string;
  comment?: string;
  useContinueOnFailure?: boolean;
}): PayloadSendBlock {
  const payloadVar = opts.vars.payload(opts.scenarioSuffix);
  const requestVar = opts.vars.request(opts.scenarioSuffix);
  const responseVar = opts.vars.response(opts.scenarioSuffix);
  const handling = opts.useContinueOnFailure ? "CONTINUE_ON_FAILURE" : "STOP_ON_FAILURE";

  const lines: string[] = [
    "",
    `// ${opts.title}`,
  ];
  if (opts.comment) lines.push(`// ${opts.comment}`);

  lines.push(
    `Map ${payloadVar} = ${emitGroovyMapLiteral(opts.payload)}`,
    `RequestObject ${requestVar} = ApiRequestBuilder.prepare('${opts.requestPath}')`,
    `${requestVar} = ApiPayloadBuilder.withBody(${requestVar}, ${payloadVar})`,
    `def ${responseVar} = WS.sendRequest(${requestVar}, FailureHandling.${handling})`,
    `ResponseValidator.assertStatus(${responseVar}, ${opts.expectedStatus})`
  );

  return { lines, responseVar, title: opts.title };
}
