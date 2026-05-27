/** Katalon TestObject / OR .rs selector hints for copy-paste. */
export function buildOrLocatorSnippet(type: string, value: string): string {
  const t = type.toLowerCase();
  const v = value.replace(/'/g, "\\'");
  if (t === "id") return `id=${value.replace(/^#/, "")}`;
  if (t === "name") return `name=${value}`;
  if (t === "xpath") return `xpath=${value.replace(/^xpath=/i, "")}`;
  if (t === "css") return `css=${value}`;
  return `${t}=${value}`;
}

export function buildRsSelectorHint(oldType: string, oldValue: string, newType: string, newValue: string): string {
  return [
    `<!-- Update primary selector in Object Repository -->`,
    `<!-- Was (${oldType}): ${oldValue} -->`,
    `<!-- Suggested (${newType}): ${newValue} -->`,
    `<key>${mapTypeToRsKey(newType)}</key>`,
    `<value>${escapeXml(newValue)}</value>`,
  ].join("\n");
}

function mapTypeToRsKey(type: string): string {
  const t = type.toLowerCase();
  if (t === "id") return "BASIC";
  if (t === "name") return "NAME";
  if (t === "xpath") return "XPATH";
  if (t === "css") return "CSS";
  return "BASIC";
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
