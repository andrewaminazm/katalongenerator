/**
 * Full Playwright script → structured DSL (preserves goto / fill / type / click / press order).
 * Fails loudly when a line looks like a Playwright interaction but cannot be parsed.
 */

import { resolveSemanticTarget } from "./testDsl/targetResolver.js";
import type { TestDslStep } from "./testDsl/universalStepNormalizer.js";
import { canonicalize } from "./testDsl/universalStepNormalizer.js";
import {
  buildRecordingTestObjectLabel,
  resetSemanticNameRegistry,
} from "./recordingIntelligence/semanticElementMapper.js";

export interface PlaywrightDslParseResult {
  dsl: TestDslStep[];
  canonicalSteps: string[];
  locators: { name: string; selector: string }[];
  warnings: string[];
  errors: string[];
}

/** When `preserveFullTrace` is true, duplicate navigations and identical consecutive fills are kept (lossless replay). */
export interface PlaywrightParseOptions {
  preserveFullTrace?: boolean;
}

type InternalOp =
  | { kind: "goto"; url: string; line: number; raw: string }
  | { kind: "fill"; selector: string; value: string; line: number; raw: string }
  | { kind: "click"; selector: string; line: number; raw: string }
  | { kind: "press"; selector: string; key: string; line: number; raw: string }
  | { kind: "check"; selector: string; line: number; raw: string }
  | { kind: "uncheck"; selector: string; line: number; raw: string };

function parsePlaywrightDebug(): boolean {
  const v = process.env.PARSE_PLAYWRIGHT_DEBUG?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/** Strip trailing semicolon from a statement chunk. */
function stripTrailingSemicolon(s: string): string {
  return s.replace(/;\s*$/, "").trim();
}

/**
 * One physical line may contain multiple await page.* calls; split so each segment is parsed separately.
 */
export function splitPlaywrightScriptLine(line: string): string[] {
  const s = stripLineComment(line).trim();
  if (!s) return [];
  const byAwait = s
    .split(/\s*(?=\bawait\s+page\.)/i)
    .map((p) => stripTrailingSemicolon(p).trim())
    .filter(Boolean);
  if (byAwait.length > 1) return byAwait;
  const byPage = s
    .split(/\s*(?=\bpage\.(?:goto|click|fill|type|press|check|uncheck|locator)\s*\()/i)
    .map((p) => stripTrailingSemicolon(p).trim())
    .filter(Boolean);
  const onlyPage = byPage.filter((p) => /\bpage\.(?:goto|click|fill|type|press|check|uncheck|locator)\s*\(/i.test(p));
  return onlyPage.length > 0 ? onlyPage : [stripTrailingSemicolon(s)];
}

/** Find index after closing `)` matching `(` at openParenIdx (strings/backticks respected). */
function consumeBalancedParens(s: string, openParenIdx: number): number {
  let depth = 0;
  let q: string | null = null;
  for (let i = openParenIdx; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === "\\" && q !== "`") {
        i++;
        continue;
      }
      if (c === q) q = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      q = c;
      continue;
    }
    if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function skipWs(s: string, i: number): number {
  let j = i;
  while (j < s.length && /\s/.test(s[j])) j++;
  return j;
}

/** Parse a JS single- or double-quoted string starting at `i` (escape-aware). */
export function parseJsStringLiteral(s: string, i: number): { value: string; end: number } | null {
  const q = s[i];
  if (q !== "'" && q !== '"') return null;
  let out = "";
  let j = i + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === "\\" && j + 1 < s.length) {
      const n = s[j + 1];
      if (n === "n") {
        out += "\n";
        j += 2;
      } else if (n === "r") {
        out += "\r";
        j += 2;
      } else if (n === "t") {
        out += "\t";
        j += 2;
      } else {
        out += n;
        j += 2;
      }
      continue;
    }
    if (c === q) return { value: out, end: j + 1 };
    out += c;
    j++;
  }
  return null;
}

function parseBacktickTemplate(s: string, i: number): { value: string; end: number } | null {
  if (s[i] !== "`") return null;
  let out = "";
  let j = i + 1;
  while (j < s.length) {
    const c = s[j];
    if (c === "\\" && j + 1 < s.length) {
      out += s[j + 1];
      j += 2;
      continue;
    }
    if (c === "`") return { value: out, end: j + 1 };
    out += c;
    j++;
  }
  return null;
}

function parseFirstStringArg(s: string, openParenIdx: number): { value: string; end: number } | null {
  const i = skipWs(s, openParenIdx + 1);
  const sq = parseJsStringLiteral(s, i);
  if (sq) return sq;
  return parseBacktickTemplate(s, i);
}

function stripLineComment(line: string): string {
  const idx = line.indexOf("//");
  if (idx < 0) return line;
  const before = line.slice(0, idx);
  const inQuotes = (() => {
    let q: string | null = null;
    for (let i = 0; i < idx; i++) {
      const c = line[i];
      if (q) {
        if (c === "\\" && i + 1 < idx) continue;
        if (c === q) q = null;
        continue;
      }
      if (c === "'" || c === '"') q = c;
      if (c === "`") q = "`";
    }
    return q !== null;
  })();
  return inQuotes ? line : before.trimEnd();
}

/** Derive a stable target token from a Playwright selector (for DSL / locator naming). */
export function selectorToTargetHint(selector: string): string {
  const s = selector.trim();
  const id = /^#([\w-:.]+)$/.exec(s);
  if (id) return id[1];
  const nm = /\[name\s*=\s*["']([^"']+)["']\s*\]/i.exec(s);
  if (nm) return `name_${nm[1].replace(/[^\w]+/g, "_")}`;
  const dt = /\[data-testid\s*=\s*["']([^"']+)["']\s*\]/i.exec(s);
  if (dt) return `testid_${dt[1].replace(/[^\w]+/g, "_")}`;
  const cls = /^([a-zA-Z][\w-]*)\\.([\w-]+)$/.exec(s);
  if (cls) return `${cls[1]}_${cls[2]}`;
  return resolveSemanticTarget(s);
}

function looksLikePlaywrightInteraction(line: string): boolean {
  return /\bpage\.(goto|fill|type|click|press|check|uncheck|locator)\s*\(/i.test(line);
}

function parseGoto(line: string, lineNo: number): InternalOp | null {
  const m = line.match(/\bpage\.goto\s*\(\s*/i);
  if (!m) return null;
  const start = line.indexOf(m[0]);
  const open = start + m[0].length - 1;
  const first = parseFirstStringArg(line, open);
  if (!first) return null;
  return { kind: "goto", url: first.value, line: lineNo, raw: line };
}

function parseFillOrType(line: string, lineNo: number): InternalOp | null {
  const m = line.match(/\bpage\.(fill|type)\s*\(\s*/i);
  if (!m) return null;
  const open = line.indexOf(m[0]) + m[0].length - 1;
  const sel = parseFirstStringArg(line, open);
  if (!sel) return null;
  let i = skipWs(line, sel.end);
  if (line[i] !== ",") return null;
  i = skipWs(line, i + 1);
  const val = parseJsStringLiteral(line, i) ?? parseBacktickTemplate(line, i);
  if (!val) return null;
  return { kind: "fill", selector: sel.value, value: val.value, line: lineNo, raw: line };
}

function parseClick(line: string, lineNo: number): InternalOp | null {
  const m = line.match(/\bpage\.click\s*\(\s*/i);
  if (!m) return null;
  const open = line.indexOf(m[0]) + m[0].length - 1;
  const sel = parseFirstStringArg(line, open);
  if (!sel) return null;
  return { kind: "click", selector: sel.value, line: lineNo, raw: line };
}

function parsePress(line: string, lineNo: number): InternalOp | null {
  const m = line.match(/\bpage\.press\s*\(\s*/i);
  if (!m) return null;
  const open = line.indexOf(m[0]) + m[0].length - 1;
  const sel = parseFirstStringArg(line, open);
  if (!sel) return null;
  let i = skipWs(line, sel.end);
  if (line[i] !== ",") return null;
  i = skipWs(line, i + 1);
  const keyLit = parseJsStringLiteral(line, i);
  if (!keyLit) return null;
  return { kind: "press", selector: sel.value, key: keyLit.value, line: lineNo, raw: line };
}

function parseCheck(line: string, lineNo: number): InternalOp | null {
  const m = line.match(/\bpage\.check\s*\(\s*/i);
  if (!m) return null;
  const open = line.indexOf(m[0]) + m[0].length - 1;
  const sel = parseFirstStringArg(line, open);
  if (!sel) return null;
  return { kind: "check", selector: sel.value, line: lineNo, raw: line };
}

function parseUncheck(line: string, lineNo: number): InternalOp | null {
  const m = line.match(/\bpage\.uncheck\s*\(\s*/i);
  if (!m) return null;
  const open = line.indexOf(m[0]) + m[0].length - 1;
  const sel = parseFirstStringArg(line, open);
  if (!sel) return null;
  return { kind: "uncheck", selector: sel.value, line: lineNo, raw: line };
}

/** page.locator('sel').fill('v') | .click() | .press('Key') */
function parseLocatorChain(line: string, lineNo: number): InternalOp | null {
  const m = line.match(/\bpage\.locator\s*\(\s*/i);
  if (!m) return null;
  const openParen = line.indexOf(m[0]) + m[0].length - 1;
  const sel = parseFirstStringArg(line, openParen);
  if (!sel) return null;
  let i = skipWs(line, sel.end);
  if (line[i] !== ")") return null;
  i = skipWs(line, i + 1);
  if (line[i] !== ".") return null;
  i = skipWs(line, i + 1);
  const chain = line.slice(i);
  const fillM = chain.match(/^(fill|type)\s*\(\s*/i);
  const clickM = chain.match(/^click\s*\(\s*/i);
  const pressM = chain.match(/^press\s*\(\s*/i);
  if (fillM) {
    const parenIdx = i + fillM[0].length - 1;
    const j = skipWs(line, parenIdx + 1);
    const val = parseJsStringLiteral(line, j) ?? parseBacktickTemplate(line, j);
    if (!val) return null;
    return { kind: "fill", selector: sel.value, value: val.value, line: lineNo, raw: line };
  }
  if (clickM) {
    const openParenIdx = i + clickM[0].length - 1;
    const end = consumeBalancedParens(line, openParenIdx);
    if (end < 0) return null;
    return { kind: "click", selector: sel.value, line: lineNo, raw: line };
  }
  if (pressM) {
    const openParenIdx = i + pressM[0].length - 1;
    const end = consumeBalancedParens(line, openParenIdx);
    if (end < 0) return null;
    const innerStart = skipWs(line, openParenIdx + 1);
    const keyLit = parseJsStringLiteral(line, innerStart);
    if (!keyLit) return null;
    return { kind: "press", selector: sel.value, key: keyLit.value, line: lineNo, raw: line };
  }
  return null;
}

function parseOneLine(line: string, lineNo: number): InternalOp | null {
  const s = stripLineComment(line).trim();
  if (!s) return null;
  return (
    parseGoto(s, lineNo) ??
    parseLocatorChain(s, lineNo) ??
    parseFillOrType(s, lineNo) ??
    parseCheck(s, lineNo) ??
    parseUncheck(s, lineNo) ??
    parseClick(s, lineNo) ??
    parsePress(s, lineNo)
  );
}

function dedupeNavAndRedundantFills(ops: InternalOp[]): InternalOp[] {
  const out: InternalOp[] = [];
  let lastNavUrl: string | null = null;
  for (const op of ops) {
    if (op.kind === "goto") {
      try {
        const u = new URL(op.url);
        u.hash = "";
        const key = u.href;
        if (lastNavUrl === key) continue;
        lastNavUrl = key;
      } catch {
        if (lastNavUrl === op.url) continue;
        lastNavUrl = op.url;
      }
      out.push(op);
      continue;
    }
    if (op.kind === "fill") {
      const prev = out[out.length - 1];
      if (
        prev &&
        prev.kind === "fill" &&
        prev.selector === op.selector &&
        prev.value === op.value
      ) {
        continue;
      }
      out.push(op);
      continue;
    }
    out.push(op);
  }
  return out;
}

function internalToTestDsl(
  ops: InternalOp[],
  locators: { name: string; selector: string }[]
): TestDslStep[] {
  const dsl: TestDslStep[] = [];
  const selectorToLabel = new Map<string, string>();

  const labelFor = (selector: string, interactionVerb: string): string => {
    const prev = selectorToLabel.get(selector);
    if (prev) return prev;
    const name = buildRecordingTestObjectLabel(selector, interactionVerb);
    selectorToLabel.set(selector, name);
    locators.push({ name, selector });
    return name;
  };

  for (const op of ops) {
    if (op.kind === "goto") {
      dsl.push({
        action: "navigate",
        value: op.url,
        intent: "navigation",
        sourceConfidence: 98,
        raw: op.raw,
        context: { playwrightLine: op.line, source: "playwright" },
      });
      continue;
    }
    if (op.kind === "fill") {
      const target = labelFor(op.selector, "fill");
      dsl.push({
        action: "type",
        target,
        value: op.value,
        intent: "input",
        sourceConfidence: 98,
        raw: op.raw,
        context: { playwrightLine: op.line, source: "playwright", selector: op.selector },
      });
      continue;
    }
    if (op.kind === "check") {
      const target = labelFor(op.selector, "check");
      dsl.push({
        action: "check",
        target,
        intent: "interaction",
        sourceConfidence: 98,
        raw: op.raw,
        context: { playwrightLine: op.line, source: "playwright", selector: op.selector },
      });
      continue;
    }
    if (op.kind === "uncheck") {
      const target = labelFor(op.selector, "uncheck");
      dsl.push({
        action: "uncheck",
        target,
        intent: "interaction",
        sourceConfidence: 98,
        raw: op.raw,
        context: { playwrightLine: op.line, source: "playwright", selector: op.selector },
      });
      continue;
    }
    if (op.kind === "click") {
      const target = labelFor(op.selector, "click");
      dsl.push({
        action: "click",
        target,
        intent: "interaction",
        sourceConfidence: 98,
        raw: op.raw,
        context: { playwrightLine: op.line, source: "playwright", selector: op.selector },
      });
      continue;
    }
    if (op.kind === "press") {
      const target = labelFor(op.selector, "press");
      dsl.push({
        action: "keyAction",
        target,
        value: op.key,
        intent: "interaction",
        sourceConfidence: 98,
        raw: op.raw,
        context: { playwrightLine: op.line, source: "playwright", selector: op.selector },
      });
    }
  }
  return dsl;
}

/**
 * Parse a Playwright recording script into canonical DSL steps and locator lines.
 * Emits `errors` when any non-empty line looks like Playwright API but was not parsed (action dropped).
 */
export function parsePlaywrightScriptToDsl(
  script: string,
  options?: PlaywrightParseOptions
): PlaywrightDslParseResult {
  resetSemanticNameRegistry();
  const dbg = parsePlaywrightDebug();
  const lines = script.split(/\r?\n/);
  const rawOps: InternalOp[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let expectedSegments = 0;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNo = idx + 1;
    const line = lines[idx];
    const trimmed = stripLineComment(line).trim();
    if (!trimmed) continue;
    if (/^(import|export|const|let|var|function)\b/.test(trimmed)) continue;

    const segments = splitPlaywrightScriptLine(line);
    for (const seg of segments) {
      const part = stripTrailingSemicolon(seg).trim();
      if (!part) continue;
      if (/^(import|export|const|let|var|function)\b/.test(part)) continue;

      if (looksLikePlaywrightInteraction(part)) expectedSegments++;

      const parsed = parseOneLine(part, lineNo);
      if (parsed) {
        rawOps.push(parsed);
        if (dbg) console.log("PARSED STEP:", parsed);
        continue;
      }

      if (looksLikePlaywrightInteraction(part)) {
        errors.push(
          `action dropped during parsing (line ${lineNo}): could not parse Playwright call — ${part.slice(0, 200)}`
        );
      }
    }
  }

  if (expectedSegments > 0 && rawOps.length < expectedSegments && errors.length === 0) {
    errors.push(
      `Parser lost actions: expected ${expectedSegments} Playwright call(s), parsed ${rawOps.length}`
    );
  }

  // Lossless backend parse: never discard successfully parsed ops because a later line failed.
  const ops =
    options?.preserveFullTrace === true ? rawOps : dedupeNavAndRedundantFills(rawOps);
  const locators: { name: string; selector: string }[] = [];
  const dsl = internalToTestDsl(ops, locators);
  const canonicalSteps = dsl.map((s) => canonicalize(s));
  return { dsl, canonicalSteps, locators, warnings, errors };
}
