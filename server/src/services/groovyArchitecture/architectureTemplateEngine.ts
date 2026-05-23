import { defaultPackage } from "../groovyGenerator/groovyImportResolver.js";

export function wrapGroovyClass(opts: {
  packageName?: string;
  imports: string[];
  className: string;
  bodyLines: string[];
  useKeyword?: boolean;
}): string {
  const pkg = opts.packageName ?? defaultPackage();
  const lines = [`package ${pkg}`, "", ...opts.imports, "", `class ${opts.className} {`, ""];
  for (const bl of opts.bodyLines) {
    if (!bl.trim()) {
      lines.push("");
      continue;
    }
    const indented = bl.split("\n").map((l) => (l.trim() ? `    ${l}` : ""));
    lines.push(...indented);
  }
  lines.push("}", "");
  return lines.join("\n").trimEnd() + "\n";
}

export function groovyComment(text: string): string {
  return `// ${text}`;
}
