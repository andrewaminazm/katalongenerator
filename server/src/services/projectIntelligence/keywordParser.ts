import type { ParsedKeywordClass, ParsedKeywordMethod } from "./types.js";
import { keywordPackageFromPath, normalizeRelPath } from "./paths.js";
import { detectUrl, inferKnownSiteUrl } from "../testDsl/intentClassifier.js";

function summarizeMethod(name: string, doc?: string): string {
  const d = (doc ?? "").toLowerCase();
  const n = name.toLowerCase();
  if (/login|sign\s*in|log\s*in/.test(n + d)) return "logs into application";
  if (/logout|sign\s*out/.test(n + d)) return "logs out of application";
  if (/navigate|goto|open/.test(n + d)) return "navigates to page or section";
  if (/create|add|new/.test(n + d)) return "creates a new entity";
  if (/search|find|query/.test(n + d)) return "searches or filters data";
  if (/submit|save|confirm/.test(n + d)) return "submits or saves form";
  return `${name} custom keyword`;
}

/**
 * Lightweight Groovy keyword parser (regex-based, fault-tolerant).
 */
export function parseKeywordGroovyFile(relPath: string, content: string): ParsedKeywordClass | null {
  try {
    const norm = normalizeRelPath(relPath);
    if (!/Keywords\//i.test(norm) || !/\.groovy$/i.test(norm)) return null;

    const pkg = keywordPackageFromPath(norm);
    const packageDecl = content.match(/^\s*package\s+([\w.]+)/m)?.[1]?.trim();
    const classMatch = content.match(/class\s+(\w+)/);
    const className = classMatch?.[1] ?? norm.split("/").pop()?.replace(/\.groovy$/i, "") ?? "Keywords";
    const packageName = packageDecl || pkg || className;

    const methods: ParsedKeywordMethod[] = [];
    const methodRe =
      /(?:@Keyword[^\n]*\n\s*)?(?:def|void)\s+(\w+)\s*\(([^)]*)\)/g;
    let m: RegExpExecArray | null;
    while ((m = methodRe.exec(content)) !== null) {
      const name = m[1];
      const paramsRaw = m[2].trim();
      const parameters = paramsRaw
        ? paramsRaw.split(",").map((p) => p.trim().split(/\s+/).pop() ?? p.trim()).filter(Boolean)
        : [];
      const before = content.slice(Math.max(0, m.index - 400), m.index);
      const docMatch = before.match(/\/\*\*([\s\S]*?)\*\//);
      const docComment = docMatch?.[1]?.replace(/\s*\*\s?/g, " ").trim();
      methods.push({
        name,
        signature: `${name}(${paramsRaw})`,
        parameters,
        docComment,
        semanticSummary: summarizeMethod(name, docComment),
      });
    }

    const customKeywordsPath = packageDecl
      ? `${packageDecl}.${className}`
      : packageName.includes(".")
        ? packageName
        : `${packageName}.${className}`;

    return {
      packageName,
      className,
      filePath: norm,
      methods,
      customKeywordsPath,
    };
  } catch {
    return null;
  }
}

export interface KeywordCallOptions {
  defaultUrl?: string;
  defaultTimeoutSec?: number;
  /** Literals from the step line, e.g. openToUrl("google") → ["google"]. */
  stepLiteralArgs?: string[];
}

export function resolveUrlParameterValue(literal: string | undefined, defaultUrl?: string): string {
  const fallback = defaultUrl?.trim() || "https://your-site.com";
  const t = literal?.trim();
  if (!t) return fallback;
  const asUrl = detectUrl(t);
  if (asUrl) return asUrl;
  const site = inferKnownSiteUrl(`visit ${t}`);
  if (site) return site;
  if (t.includes(".") && !/\s/.test(t)) {
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  }
  return fallback;
}

function escGroovyString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function formatKeywordCall(
  kw: ParsedKeywordClass,
  method: ParsedKeywordMethod,
  options?: KeywordCallOptions
): string {
  const path = `${kw.customKeywordsPath}.${method.name}`;
  const args = method.parameters.map((p) => {
    const name = p.toLowerCase();
    if (/url|uri|link|href/.test(name)) {
      const url = resolveUrlParameterValue(options?.stepLiteralArgs?.[0], options?.defaultUrl);
      return `'${escGroovyString(url)}'`;
    }
    if (/timeout|sec|second|wait/.test(name)) {
      return String(options?.defaultTimeoutSec ?? 10);
    }
    if (/user|name|email|login/.test(name)) {
      return "''";
    }
    if (/pass|password/.test(name)) {
      return "''";
    }
    return "''";
  });
  return `CustomKeywords.'${path}'(${args.join(", ")})`;
}
