function escapeXpathLiteral(s: string): string {
  // XPath 1.0 literal rules: single quotes or double quotes; otherwise concat.
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"')) return `"${s}"`;
  const parts = s.split("'");
  const items: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].length > 0) items.push(`'${parts[i]}'`);
    if (i !== parts.length - 1) items.push(`"'"`);
  }
  return `concat(${items.join(", ")})`;
}

export type XpathPredicate =
  | { kind: "attrEquals"; attr: string; value: string }
  | { kind: "textEquals"; value: string }
  | { kind: "or"; preds: XpathPredicate[] };

export function attrEquals(attr: string, value: string): XpathPredicate {
  return { kind: "attrEquals", attr, value };
}

export function textEquals(value: string): XpathPredicate {
  return { kind: "textEquals", value };
}

export function orPred(preds: XpathPredicate[]): XpathPredicate {
  return { kind: "or", preds };
}

function renderPredicate(p: XpathPredicate): string {
  if (p.kind === "attrEquals") {
    const a = p.attr.replace(/^@/, "");
    return `@${a}=${escapeXpathLiteral(p.value)}`;
  }
  if (p.kind === "textEquals") {
    // Prefer normalize-space() for robustness.
    return `normalize-space()=${escapeXpathLiteral(p.value)}`;
  }
  const inner = p.preds.map(renderPredicate).filter(Boolean);
  if (inner.length === 0) return "";
  if (inner.length === 1) return inner[0];
  return `(${inner.join(" or ")})`;
}

export function buildXPathForElements(elements: string[], predicate?: XpathPredicate): string {
  const uniq = [...new Set(elements.map((e) => e.trim()).filter(Boolean))];
  const test =
    uniq.length === 0
      ? "*"
      : uniq.length === 1
        ? `self::${uniq[0]}`
        : uniq.map((e) => `self::${e}`).join(" or ");
  const pred = predicate ? renderPredicate(predicate) : "";
  return pred ? `//*[${test}][${pred}]` : `//*[${test}]`;
}

export function buildTextXPath(text: string, element?: string): string {
  const el = element?.trim() ? `//${element.trim()}` : "//*";
  return `${el}[normalize-space()=${escapeXpathLiteral(text)}]`;
}

