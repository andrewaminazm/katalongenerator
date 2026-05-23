import { useCallback, useRef, useState, type ReactNode } from "react";

const BUBBLE_MAX_W = 300;

function placeBubble(el: HTMLElement): { top: number; left: number } {
  const r = el.getBoundingClientRect();
  let left = Math.max(8, r.left);
  if (left + BUBBLE_MAX_W > window.innerWidth - 8) {
    left = window.innerWidth - BUBBLE_MAX_W - 8;
  }
  let top = r.bottom + 6;
  if (top + 140 > window.innerHeight - 8) {
    top = Math.max(8, r.top - 6);
  }
  return { top, left };
}

/** Visible help control — hover/focus shows tooltip (fixed, not clipped by scroll). */
export function TipIcon({ tip }: { tip: string }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = useCallback(() => {
    const el = triggerRef.current;
    if (el) setPos(placeBubble(el));
  }, []);

  const hide = useCallback(() => setPos(null), []);

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
};

export function ActionWithTip({
  tip,
  children,
  className = "btn btn-primary",
  disabled,
  onClick,
}: ActionWithTipProps) {
  return (
    <span className="action-with-tip">
      <button type="button" className={className} onClick={onClick} disabled={disabled}>
        {children}
      </button>
      <TipIcon tip={tip} />
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

