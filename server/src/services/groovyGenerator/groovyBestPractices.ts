export function capitalize(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function toPascalCase(subject: string): string {
  return subject
    .trim()
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => capitalize(w.replace(/[^a-zA-Z0-9]/g, "")))
    .filter(Boolean)
    .join("") || "Custom";
}

export function inferUtilityClassName(subject: string, suffix = "Utils"): string {
  const base = toPascalCase(subject);
  if (base.endsWith(suffix) || base.endsWith("Helper") || base.endsWith("Manager")) {
    return base;
  }
  const lower = subject.toLowerCase();
  if (/\bhelper\b/.test(lower) || /\bretry\b/.test(lower)) return `${base}Helper`;
  if (/\bmanager\b/.test(lower) || /\bbrowser\b/.test(lower)) return `${base}Manager`;
  if (/\bvalidator\b/.test(lower)) return `${base}Validator`;
  if (/\bservice\b/.test(lower) || /\bapi\b/.test(lower)) return `${base}Service`;
  if (/\bparser\b/.test(lower) || /\bjson\b/.test(lower)) return `${base}Parser`;
  if (/\bformatter\b/.test(lower) || /\bdate\b/.test(lower)) return `${base}Formatter`;
  return `${base}${suffix}`;
}

export function inferMethodName(subject: string): string {
  const lower = subject.toLowerCase();
  const aliases: Record<string, string> = {
    "random email": "generateRandomEmail",
    "random email generation": "generateRandomEmail",
    "random name": "generateRandomName",
    "random name generation": "generateRandomName",
    "generate random name": "generateRandomName",
    "date formatting": "formatDate",
    "screenshot capture": "captureScreenshot",
    "api token": "generateToken",
    "api token helper": "generateToken",
    retry: "retry",
    "retry mechanism": "retry",
    "dynamic xpath": "buildDynamicXPath",
    encryption: "encrypt",
    "wait until visible": "waitUntilVisible",
    "json parser": "parseJson",
    "excel reader": "readExcel",
    "file upload": "uploadFile",
    pagination: "paginate",
  };
  if (aliases[lower]) return aliases[lower];

  const words = subject.trim().split(/[\s_-]+/).filter(Boolean);
  if (words.length === 0) return "execute";
  if (words.length === 1) {
    const w = words[0].toLowerCase();
    if (w === "retry") return "retry";
    return w.replace(/[^a-zA-Z0-9]/g, "") || "execute";
  }
  const [first, ...rest] = words;
  return (
    first.toLowerCase().replace(/[^a-zA-Z0-9]/g, "") +
    rest.map((w) => capitalize(w.replace(/[^a-zA-Z0-9]/g, ""))).join("")
  );
}
