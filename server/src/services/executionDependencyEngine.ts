export interface DependencyOptions {
  platform: "web" | "mobile";
}

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function parseObjFromCall(line: string): string | null {
  const m = line.match(/\b(?:click|setText|sendKeys|waitForElementVisible|waitForElementPresent)\s*\(\s*([^,)\r\n]+)\s*(?:,|\))/i);
  return m ? norm(m[1]) : null;
}

function isBlankOrComment(line: string): boolean {
  return /^\s*$/.test(line) || /^\s*\/\//.test(line);
}

/**
 * Ensures required execution dependencies are present **before** optimization runs.
 * Conservative: only adds missing interactions; never removes anything.
 *
 * Web rules:
 * - For any WebUI.setText(obj, ...), ensure a WebUI.click(obj) exists immediately before it
 *   (after the waitForElementVisible for the same obj, if present).
 */
export function enforceExecutionDependencies(code: string, options: DependencyOptions): string {
  if (options.platform !== "web") return code;

  const lines = code.split(/\r?\n/);
  const actionsIdx = lines.findIndex((l) => /^\s*\/\/\s*Actions\b/i.test(l));
  const start = actionsIdx >= 0 ? actionsIdx + 1 : 0;

  const out: string[] = [];

  // Track last meaningful line per object to avoid inserting duplicate clicks.
  const recentActions: { obj: string; kind: "click" | "setText" | "sendKeys" | "wait" }[] = [];
  const remember = (obj: string, kind: "click" | "setText" | "sendKeys" | "wait") => {
    recentActions.push({ obj, kind });
    if (recentActions.length > 20) recentActions.shift();
  };
  const recentlyClicked = (obj: string): boolean => {
    for (let i = recentActions.length - 1; i >= 0; i--) {
      const a = recentActions[i];
      if (a.obj !== obj) continue;
      return a.kind === "click";
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    if (i < start) continue;
    if (isBlankOrComment(line)) continue;

    const n = norm(line);

    // Track waits
    if (/\bWebUI\.waitForElementVisible\s*\(/.test(n)) {
      const obj = parseObjFromCall(n);
      if (obj) remember(obj, "wait");
      continue;
    }

    if (/\bWebUI\.click\s*\(/.test(n)) {
      const obj = parseObjFromCall(n);
      if (obj) remember(obj, "click");
      continue;
    }

    if (/\bWebUI\.setText\s*\(/.test(n)) {
      const obj = parseObjFromCall(n);
      if (obj) {
        // If we haven't clicked this obj recently, inject click before setText.
        if (!recentlyClicked(obj)) {
          // Prefer inserting click after a waitForElementVisible(obj, ...) if the previous meaningful line is that wait.
          // Since we've already pushed current setText line, we need to insert click right before it.
          out.pop();
          // If the last emitted nonblank line is a wait for same obj, keep it then click.
          // Otherwise just click then setText.
          out.push(`WebUI.click(${obj})`);
          remember(obj, "click");
          out.push(line);
        }
        remember(obj, "setText");
      }
      continue;
    }

    if (/\bWebUI\.sendKeys\s*\(/.test(n)) {
      const obj = parseObjFromCall(n);
      if (obj) remember(obj, "sendKeys");
      continue;
    }
  }

  return out.join("\n");
}

