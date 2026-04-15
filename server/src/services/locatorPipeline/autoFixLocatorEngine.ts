import { classifyRhs } from "../katalonCompiler/locatorParser.js";
import { hasPlaywrightLeakage, describeLeakageReason } from "./locatorFirewall.js";
import { translateLocatorRhs } from "./locatorTranslator.js";
import { isValidTestObjectLocator } from "./testObjectValidator.js";

export interface SanitizeLocatorResult {
  text: string;
  warnings: string[];
  droppedLabels: string[];
}

function extractQuotedFallback(toxic: string): string | null {
  const m = toxic.match(/['"]([^'"]{1,200})['"]/);
  if (!m) return null;
  const inner = m[1].trim();
  if (!inner || hasPlaywrightLeakage(inner)) return null;
  const safe = inner.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  return `//*[contains(normalize-space(.),'${safe}')]`;
}

function emitLineForClassification(
  label: string,
  classified: NonNullable<ReturnType<typeof classifyRhs>>
): string {
  if (classified.kind === "orPath") {
    return `${label} = ${classified.value}`;
  }
  const { kind, propertyName, value } = classified;
  if (kind === "xpath") {
    const v = value.trim();
    return v.startsWith("//") || v.startsWith("(") ? `${label} = ${v}` : `${label} = xpath=${v}`;
  }
  if (kind === "id") {
    return `${label} = #${value.replace(/^#/, "")}`;
  }
  if (kind === "name") {
    return `${label} = name=${value}`;
  }
  if (kind === "accessibilityId") {
    return `${label} = accessibility id=${value}`;
  }
  return `${label} = ${value}`;
}

/**
 * Full pipeline: translate Playwright → validate → emit only Katalon-safe `label = rhs` lines.
 */
export function sanitizeKatalonLocatorLines(
  locatorsText: string,
  options: { platform: "web" | "mobile"; url?: string }
): SanitizeLocatorResult {
  const warnings: string[] = [];
  const droppedLabels: string[] = [];
  const outLines: string[] = [];

  for (const line of locatorsText.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) {
      outLines.push("");
      continue;
    }
    if (raw.startsWith("#")) {
      outLines.push(line);
      continue;
    }
    const eq = raw.indexOf("=");
    if (eq < 0) {
      outLines.push(line);
      continue;
    }
    const label = raw.slice(0, eq).trim();
    let rhs = raw.slice(eq + 1).trim();

    if (!label) {
      outLines.push(line);
      continue;
    }

    const originalRhs = rhs;
    if (hasPlaywrightLeakage(rhs)) {
      const reason = describeLeakageReason(rhs) ?? "Playwright/JS API";
      rhs = translateLocatorRhs(rhs, { platform: options.platform, url: options.url });
      warnings.push(`Translated Playwright in "${label}": ${reason}`);
    }

    if (hasPlaywrightLeakage(rhs)) {
      const fb = extractQuotedFallback(originalRhs);
      if (fb) {
        rhs = fb.startsWith("//") ? fb : `xpath=${fb}`;
        warnings.push(`Fallback XPath from quoted text for "${label}"`);
      }
    }

    if (hasPlaywrightLeakage(rhs)) {
      droppedLabels.push(label);
      warnings.push(
        `Dropped locator line "${label}" — ${describeLeakageReason(rhs) ?? "still contains blocked APIs after translation"}`
      );
      continue;
    }

    const classified = classifyRhs(rhs);
    if (!classified) {
      droppedLabels.push(label);
      warnings.push(`Dropped "${label}" — unclassifiable locator after sanitization`);
      continue;
    }

    if (classified.kind !== "orPath") {
      if (!isValidTestObjectLocator(classified.propertyName, classified.value)) {
        droppedLabels.push(label);
        warnings.push(`Dropped "${label}" — invalid TestObject locator value`);
        continue;
      }
    }

    outLines.push(emitLineForClassification(label, classified));
  }

  const text = outLines.join("\n").replace(/\n{3,}/g, "\n\n");
  return { text: text.trimEnd() + (text.trim() ? "\n" : ""), warnings, droppedLabels };
}

function parseAddPropertyCall(call: string): { prop: string; valueRaw: string } | null {
  const propMatch = call.match(/addProperty\s*\(\s*['"]([^'"]+)['"]/i);
  if (!propMatch) return null;
  const prop = propMatch[1];
  const eq = call.indexOf("ConditionType.EQUALS");
  if (eq < 0) return null;
  const after = call.slice(eq + "ConditionType.EQUALS".length);
  const comma = after.indexOf(",");
  if (comma < 0) return null;
  const rest = after.slice(comma + 1).trim();
  const q = rest[0];
  if (q !== "'" && q !== '"') return null;
  let i = 1;
  let buf = "";
  while (i < rest.length) {
    const c = rest[i];
    if (c === "\\") {
      buf += rest[i + 1] ?? "";
      i += 2;
      continue;
    }
    if (c === q) break;
    buf += c;
    i++;
  }
  return { prop, valueRaw: buf };
}

/**
 * Last-resort pass on generated Groovy: rewrite addProperty third-arg strings that still contain Playwright APIs.
 */
export function stripPlaywrightLeakageFromGroovy(code: string): string {
  const lines = code.split(/\r?\n/);
  return lines
    .map((line) => {
      if (!hasPlaywrightLeakage(line) || !/addProperty\s*\(/i.test(line)) {
        return line;
      }
      const start = line.search(/addProperty\s*\(/i);
      if (start < 0) return line;
      const openParen = line.indexOf("(", start);
      if (openParen < 0) return `// STRIPPED: ${line.trim()}`;
      let depth = 0;
      let j = openParen;
      for (; j < line.length; j++) {
        const c = line[j];
        if (c === "(") depth++;
        else if (c === ")") {
          depth--;
          if (depth === 0) break;
        }
      }
      if (depth !== 0) return `// STRIPPED: ${line.trim()}`;
      const call = line.slice(start, j + 1);
      const parsed = parseAddPropertyCall(call);
      if (!parsed) return `// STRIPPED: ${line.trim()}`;
      const { prop, valueRaw } = parsed;
      if (!hasPlaywrightLeakage(valueRaw)) return line;
      const fixed = translateLocatorRhs(valueRaw, { platform: "web" });
      if (hasPlaywrightLeakage(fixed) || !fixed.trim()) {
        return `// STRIPPED: ${line.trim()}`;
      }
      let useProp = prop;
      let val = fixed.replace(/^xpath=/i, "").trim();
      if (
        (useProp === "css" || useProp === "xpath") &&
        (fixed.toLowerCase().startsWith("xpath=") || val.startsWith("//") || val.startsWith("("))
      ) {
        useProp = "xpath";
      }
      const esc = val.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const rebuilt = `addProperty('${useProp}', ConditionType.EQUALS, '${esc}')`;
      return line.slice(0, start) + rebuilt + line.slice(j + 1);
    })
    .join("\n");
}
