import { ExecutionStateTracker } from "./executionStateTracker.js";

export interface StateOptimizeOptions {
  platform: "web" | "mobile";
}

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isBlankOrComment(line: string): boolean {
  return /^\s*$/.test(line) || /^\s*\/\//.test(line);
}

function parseObj(line: string): string | null {
  // Extract first arg for calls like WebUI.click(obj) / waitForElementVisible(obj, 10) / setText(obj, ...)
  const m = line.match(/\b(?:waitForElementVisible|waitForElementPresent|click|setText|sendKeys|verifyElementVisible)\s*\(\s*([^,)\r\n]+)\s*(?:,|\))/i);
  return m ? norm(m[1]) : null;
}

function parseWait(line: string): { obj: string; sec: string } | null {
  const m = line.match(/waitForElement(?:Visible|Present)\s*\(\s*([^,]+)\s*,\s*([0-9]+)\s*\)/i);
  if (!m) return null;
  return { obj: norm(m[1]), sec: m[2] };
}

/**
 * State-aware optimizer: removes redundant UI actions safely.
 * Runs AFTER dependency enforcement, BEFORE final text optimizer.
 */
export function optimizeWithExecutionState(code: string, options: StateOptimizeOptions): string {
  if (options.platform !== "web") return code;

  const lines = code.split(/\r?\n/);
  const actionsIdx = lines.findIndex((l) => /^\s*\/\/\s*Actions\b/i.test(l));
  const start = actionsIdx >= 0 ? actionsIdx + 1 : 0;

  const tracker = new ExecutionStateTracker();
  const removed = new Set<number>();

  // Reset lifecycle on navigation/open.
  const isLifecycleReset = (l: string) => /\bWebUI\.(openBrowser|navigateToUrl)\s*\(/.test(l);

  // Track explicit “click first” hints in comments (rare, but safe).
  const explicitClickHint = (l: string) => /click\s+first/i.test(l);

  for (let i = start; i < lines.length; i++) {
    const raw = lines[i];
    const l = norm(raw);
    if (isBlankOrComment(raw)) continue;

    if (isLifecycleReset(l)) {
      tracker.resetLifecycle();
      continue;
    }

    // WAIT DEDUPE: keep first wait per element+timeout per lifecycle.
    const w = parseWait(l);
    if (w && /\bWebUI\.waitForElement/.test(l)) {
      const st = tracker.get(w.obj);
      const key = `${w.obj}::${w.sec}::L${tracker.getLifecycleId()}`;
      // Store in context via lastAction string comparison to avoid extra map.
      if ((st as any).__waitKey === key) {
        removed.add(i);
        continue;
      }
      (st as any).__waitKey = key;
      tracker.update(w.obj, "waitVisible");
      continue;
    }

    // CLICK DEDUPE: remove consecutive/duplicate clicks on same element within lifecycle
    if (/\bWebUI\.click\s*\(/.test(l)) {
      const obj = parseObj(l);
      if (!obj) continue;
      const st = tracker.get(obj);
      if (st.hasBeenClicked && !explicitClickHint(raw)) {
        // Safe skip: already clicked this element this lifecycle and nothing reset.
        removed.add(i);
        continue;
      }
      tracker.update(obj, "click");
      continue;
    }

    // setText: mark typed; keep as-is.
    if (/\bWebUI\.setText\s*\(/.test(l)) {
      const obj = parseObj(l);
      if (obj) tracker.update(obj, "setText");
      continue;
    }

    // sendKeys: keep; mark focus.
    if (/\bWebUI\.sendKeys\s*\(/.test(l)) {
      const obj = parseObj(l);
      if (obj) tracker.update(obj, "sendKeys");
      continue;
    }

    // verify element visible: if we already waited visible for same element this lifecycle,
    // keep verification but avoid inserting extra waits here (assembler already handles waits).
    if (/\bWebUI\.verifyElementVisible\s*\(/.test(l)) {
      const obj = parseObj(l);
      if (obj) tracker.update(obj, "verifyVisible");
      continue;
    }
  }

  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (removed.has(i)) continue;
    out.push(lines[i]);
  }
  return out.join("\n");
}

