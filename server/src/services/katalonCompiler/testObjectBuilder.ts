import type { ResolvedLocator } from "./types.js";

const RESERVED = new Set(["class", "def", "in", "if", "for", "new", "try"]);

function uniqueVarName(base: string, used: Set<string>): string {
  let v = base.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!/^[a-z_]/.test(v)) v = `t_${v}`;
  if (RESERVED.has(v)) v = `${v}_`;
  let n = v;
  let i = 2;
  while (used.has(n)) {
    n = `${v}_${i}`;
    i++;
  }
  used.add(n);
  return n;
}

export interface TestObjectDecl {
  varName: string;
  locator: ResolvedLocator;
  lines: string[];
}

/**
 * Builds one TestObject per ResolvedLocator (inline kinds only). OR-path locators use findTestObject at call site.
 */
export function buildTestObjectDeclarations(
  locators: ResolvedLocator[],
  usedVarNames: Set<string>
): TestObjectDecl[] {
  const decls: TestObjectDecl[] = [];

  for (const loc of locators) {
    if (loc.kind === "orPath") continue;

    const cap = loc.varBase.length ? loc.varBase.charAt(0).toUpperCase() + loc.varBase.slice(1) : "El";
    const varName = uniqueVarName(`t${cap}`, usedVarNames);
    const escaped = loc.value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

    const lines = [
      `TestObject ${varName} = new TestObject('${loc.varBase}')`,
      `${varName}.addProperty('${loc.propertyName}', ConditionType.EQUALS, '${escaped}')`,
    ];
    for (const fb of loc.fallbackProperties ?? []) {
      const e = fb.value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      lines.push(`${varName}.addProperty('${fb.propertyName}', ConditionType.EQUALS, '${e}')`);
    }
    decls.push({ varName, locator: loc, lines });
  }

  return decls;
}

/** Map ResolvedLocator to variable name from pre-built decls */
export function mapLocatorToVarName(
  loc: ResolvedLocator,
  decls: TestObjectDecl[]
): string | undefined {
  if (loc.kind === "orPath") return undefined;
  const d = decls.find((x) => x.locator.label === loc.label);
  return d?.varName;
}
