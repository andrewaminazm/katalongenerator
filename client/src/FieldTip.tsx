import { useCallback, useRef, useState, type ReactNode } from "react";

const BUBBLE_MAX_W = 300;
const BUBBLE_EST_HEIGHT = 120;
const TIP_SHOW_DELAY_MS = 180;

export type TipPlacement = "auto" | "above" | "below";

function placeBubble(el: HTMLElement, placement: TipPlacement = "auto"): { top: number; left: number } {
  const r = el.getBoundingClientRect();
  let left = Math.max(8, r.left);
  if (left + BUBBLE_MAX_W > window.innerWidth - 8) {
    left = window.innerWidth - BUBBLE_MAX_W - 8;
  }

  const below = r.bottom + 6;
  const above = Math.max(8, r.top - BUBBLE_EST_HEIGHT - 6);

  let top: number;
  if (placement === "above") {
    top = above;
  } else if (placement === "below") {
    top = below;
  } else if (below + BUBBLE_EST_HEIGHT > window.innerHeight - 8) {
    top = above;
  } else {
    top = below;
  }
  return { top, left };
}

/** Visible help control — hover/focus shows tooltip (fixed, not clipped by scroll). */
export function TipIcon({ tip, placement = "auto" }: { tip: string; placement?: TipPlacement }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    showTimerRef.current = setTimeout(() => {
      const el = triggerRef.current;
      if (el) setPos(placeBubble(el, placement));
    }, TIP_SHOW_DELAY_MS);
  }, [placement]);

  const hide = useCallback(() => {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    setPos(null);
  }, []);

  return (
    <span
      ref={triggerRef}
      className={`field-tip-trigger${pos ? " field-tip-trigger--open" : ""}`}
      tabIndex={0}
      role="button"
      aria-label={`Help: ${tip}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          show();
        }
      }}
    >
      <span className="field-tip-icon" aria-hidden="true">
        i
      </span>
      <span
        className="field-tip-bubble"
        role="tooltip"
        style={
          pos
            ? {
                position: "fixed",
                top: pos.top,
                left: pos.left,
                maxWidth: BUBBLE_MAX_W,
                zIndex: 10000,
              }
            : undefined
        }
      >
        {tip}
      </span>
    </span>
  );
}

type FieldBlockProps = {
  tip: string;
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

/** Label + visible help icon + control. */
export function FieldBlock({ tip, label, htmlFor, children, className }: FieldBlockProps) {
  return (
    <div className={`field-block${className ? ` ${className}` : ""}`}>
      <div className="field-label-row">
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
        <TipIcon tip={tip} />
      </div>
      {children}
    </div>
  );
}

type CheckboxTipProps = {
  tip: string;
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
};

export function CheckboxTip({ tip, label, checked, onChange, id }: CheckboxTipProps) {
  return (
    <div className="checkbox-row field-block--checkbox">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="checkbox-row-label">{label}</span>
      <TipIcon tip={tip} />
    </div>
  );
}

type TabWithTipProps = {
  tip: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
};

export function TabWithTip({ tip, active, disabled, onClick, children }: TabWithTipProps) {
  return (
    <span className="tab-with-tip-wrap">
      <button
        type="button"
        className={`tab ${active ? "active" : ""}`}
        onClick={onClick}
        disabled={disabled}
      >
        {children}
      </button>
      <TipIcon tip={tip} />
    </span>
  );
}

type ActionWithTipProps = {
  tip: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  tipPlacement?: TipPlacement;
};

export function ActionWithTip({
  tip,
  children,
  className = "btn btn-primary",
  disabled,
  onClick,
  tipPlacement = "auto",
}: ActionWithTipProps) {
  return (
    <span className="action-with-tip">
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={disabled}
        title={tip}
      >
        {children}
      </button>
      <TipIcon tip={tip} placement={tipPlacement} />
    </span>
  );
}

type ToolbarBtnProps = {
  tip: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
};

export function ToolbarBtn({ tip, children, className, disabled, onClick }: ToolbarBtnProps) {
  return (
    <span className="toolbar-btn-with-tip">
      <button type="button" className={className} onClick={onClick} disabled={disabled}>
        {children}
      </button>
      <TipIcon tip={tip} />
    </span>
  );
}

type LinkWithTipProps = {
  tip: string;
  href: string;
  children: ReactNode;
  className?: string;
  tipPlacement?: TipPlacement;
};

/** Header / nav link with the same i tooltip pattern as tabs and actions. */
export function LinkWithTip({ tip, href, children, className, tipPlacement = "auto" }: LinkWithTipProps) {
  return (
    <span className="action-with-tip">
      <a href={href} className={className}>
        {children}
      </a>
      <TipIcon tip={tip} placement={tipPlacement} />
    </span>
  );
}

