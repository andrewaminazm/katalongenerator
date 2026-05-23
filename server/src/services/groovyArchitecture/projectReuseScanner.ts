import type { ParsedKeywordClass } from "../projectIntelligence/types.js";
import type { ArchitecturePlan } from "./types.js";

function findKeywordMethod(
  keywords: ParsedKeywordClass[],
  methodPattern: RegExp,
  classPattern?: RegExp
): string | undefined {
  for (const kw of keywords) {
    if (classPattern && !classPattern.test(kw.className) && !classPattern.test(kw.customKeywordsPath)) {
      continue;
    }
    for (const m of kw.methods) {
      if (methodPattern.test(m.name)) {
        return `${kw.customKeywordsPath}.${m.name}`;
      }
    }
  }
  return undefined;
}

export function scanProjectReuse(keywords: ParsedKeywordClass[] | undefined): ArchitecturePlan["projectReuse"] {
  if (!keywords?.length) return {};
  return {
    retryHelper: findKeywordMethod(keywords, /retry/i, /retry/i),
    screenshotHelper: findKeywordMethod(keywords, /screenshot|capture/i, /screenshot/i),
    waitHelper: findKeywordMethod(keywords, /waitVisible|waitFor|waitUntil/i, /wait|ui/i),
    loginKeyword: findKeywordMethod(keywords, /login/i, /login/i),
  };
}
