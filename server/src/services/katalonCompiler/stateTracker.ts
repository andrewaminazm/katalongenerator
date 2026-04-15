import type { ResolvedLocator } from "./types.js";

/**
 * Tracks the last UI element used for implicit actions (e.g. Enter key).
 */
export class StateTracker {
  lastObject: ResolvedLocator | null = null;

  setFromLocator(loc: ResolvedLocator): void {
    this.lastObject = loc;
  }

  clear(): void {
    this.lastObject = null;
  }

  /** For press Enter when step does not name a control. */
  getForImplicitKeyboard(): ResolvedLocator | null {
    return this.lastObject;
  }
}
