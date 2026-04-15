export interface OptimizeOptions {
  platform: "web" | "mobile";
}

function normLine(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parseFirstArgString(call: string): string | null {
  // Extract first string literal inside (...) for openBrowser/navigateToUrl
  const m = call.match(/\(\s*'([^']*)'\s*(?:,|\))/);
  return m ? m[1] : null;
}

function parseWaitSignature(line: string): { obj: string; sec: string } | null {
  const m = line.match(/waitForElement(?:Visible|Present)\s*\(\s*([^,]+)\s*,\s*([0-9]+)\s*\)/i);
  if (!m) return null;
  return { obj: normLine(m[1]), sec: m[2] };
}

function parseActionObj(line: string): string | null {
  // click(obj) / setText(obj, ...) / sendKeys(obj, ...) / verifyElementVisible(obj)
  const m = line.match(/\b(?:click|setText|sendKeys|verifyElementVisible)\s*\(\s*([^,)\r\n]+)\s*(?:,|\))/i);
  return m ? normLine(m[1]) : null;
}

/**
 * Post-compilation optimizer for generated Groovy.
 * Conservative text rewrite: removes clearly redundant lines only.
 */
export function optimizeGroovyExecution(code: string, options: OptimizeOptions): string {
  const lines = code.split(/\r?\n/);

  // Identify the "Actions" block if present; otherwise operate on all lines.
  const actionsIdx = lines.findIndex((l) => /^\s*\/\/\s*Actions\b/i.test(l));
  const start = actionsIdx >= 0 ? actionsIdx + 1 : 0;

  const out: string[] = [];
  const removed = new Set<number>();

  // Rule: remove navigateToUrl(url) immediately after openBrowser(url)
  // Also remove later navigateToUrl(same url) if no other navigation occurred.
  let openUrl: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (i < start) continue;
    if (/\bWebUI\.openBrowser\s*\(/.test(ln)) {
      openUrl = parseFirstArgString(ln);
    }
    if (openUrl && /\bWebUI\.navigateToUrl\s*\(/.test(ln)) {
      const navUrl = parseFirstArgString(ln);
      if (navUrl && navUrl === openUrl) {
        removed.add(i);
      }
    }
  }

  // Rule: de-duplicate identical consecutive waits (same obj + sec)
  for (let i = start; i < lines.length - 1; i++) {
    if (removed.has(i)) continue;
    const a = parseWaitSignature(lines[i] || "");
    if (!a) continue;
    let j = i + 1;
    while (j < lines.length && /^\s*$/.test(lines[j])) j++;
    if (j >= lines.length || removed.has(j)) continue;
    const b = parseWaitSignature(lines[j] || "");
    if (b && a.obj === b.obj && a.sec === b.sec) {
      removed.add(j);
    }
  }

  // NOTE: We intentionally do NOT remove clicks before setText here.
  // Clicks may be required for focus/activation. Dependency safety is handled by the dependency engine.

  // Rule: remove duplicate verifyTextPresent identical consecutive lines (common after expansions)
  for (let i = start; i < lines.length - 1; i++) {
    if (removed.has(i)) continue;
    const a = normLine(lines[i]);
    if (!a.startsWith("WebUI.verifyTextPresent")) continue;
    let j = i + 1;
    while (j < lines.length && /^\s*$/.test(lines[j])) j++;
    if (j >= lines.length || removed.has(j)) continue;
    const b = normLine(lines[j]);
    if (a === b) removed.add(j);
  }

  // Emit
  for (let i = 0; i < lines.length; i++) {
    if (removed.has(i)) continue;
    out.push(lines[i]);
  }

  // Light tidy: collapse many blank lines
  const text = out.join("\n").replace(/\n{4,}/g, "\n\n\n").trimEnd() + (code.trim() ? "\n" : "");
  return text;
}

