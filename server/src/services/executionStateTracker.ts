export type ElementKey = string;

export interface ElementExecState {
  elementId: ElementKey;
  hasBeenClicked: boolean;
  hasBeenTyped: boolean;
  isVisibleWaited: boolean;
  lastAction?: string;
}

export class ExecutionStateTracker {
  private byEl = new Map<ElementKey, ElementExecState>();
  private lifecycleId = 0;

  resetLifecycle(): void {
    this.byEl.clear();
    this.lifecycleId++;
  }

  getLifecycleId(): number {
    return this.lifecycleId;
  }

  get(el: ElementKey): ElementExecState {
    const prev = this.byEl.get(el);
    if (prev) return prev;
    const init: ElementExecState = {
      elementId: el,
      hasBeenClicked: false,
      hasBeenTyped: false,
      isVisibleWaited: false,
    };
    this.byEl.set(el, init);
    return init;
  }

  update(el: ElementKey, action: string): void {
    const st = this.get(el);
    st.lastAction = action;
    if (action === "waitVisible") st.isVisibleWaited = true;
    if (action === "click") st.hasBeenClicked = true;
    if (action === "setText") {
      st.hasBeenTyped = true;
      // Typing implies focus; treat as clicked for later dedupe.
      st.hasBeenClicked = true;
    }
    if (action === "sendKeys") {
      // Often used to submit after typing; implies focus.
      st.hasBeenClicked = true;
    }
  }
}

