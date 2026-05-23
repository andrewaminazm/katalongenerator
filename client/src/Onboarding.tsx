import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  HELP_TOPICS,
  isOnboardingComplete,
  markOnboardingComplete,
  STEP_TEMPLATES,
  WIZARD_SLIDES,
  type HelpTopicId,
  type StepTemplate,
} from "./onboardingContent";

/* ——— First-visit wizard ——— */

type WizardProps = {
  open: boolean;
  onClose: () => void;
};

export function OnboardingWizard({ open, onClose }: WizardProps) {
  const [slide, setSlide] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSlide(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const current = WIZARD_SLIDES[slide];
  const isLast = slide === WIZARD_SLIDES.length - 1;

  const finish = () => {
    markOnboardingComplete();
    onClose();
  };

  return (
    <div className="onboarding-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="onboarding-wizard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-wizard-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="onboarding-wizard-header">
          <span className="onboarding-wizard-step">
            Step {slide + 1} of {WIZARD_SLIDES.length}
          </span>
          <button type="button" className="btn btn-ghost btn-small" onClick={onClose} aria-label="Close">
            Skip
          </button>
        </div>
        <h2 id="onboarding-wizard-title" className="onboarding-wizard-title">
          {current.title}
        </h2>
        <ul className="onboarding-wizard-list">
          {current.body.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <div className="onboarding-wizard-dots" aria-hidden="true">
          {WIZARD_SLIDES.map((s, i) => (
            <span key={s.id} className={`onboarding-dot${i === slide ? " active" : ""}`} />
          ))}
        </div>
        <div className="onboarding-wizard-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={slide === 0}
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
          >
            Back
          </button>
          {isLast ? (
            <button type="button" className="btn btn-primary" onClick={finish}>
              Get started
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setSlide((s) => Math.min(WIZARD_SLIDES.length - 1, s + 1))}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useOnboardingWizard() {
  const [wizardOpen, setWizardOpen] = useState(false);

  useEffect(() => {
    if (!isOnboardingComplete()) setWizardOpen(true);
  }, []);

  const openWizard = useCallback(() => setWizardOpen(true), []);
  const closeWizard = useCallback(() => {
    markOnboardingComplete();
    setWizardOpen(false);
  }, []);

  return { wizardOpen, openWizard, closeWizard };
}

/* ——— ? Help menu ——— */

type HelpMenuProps = {
  onOpenWizard: () => void;
};

function HelpTopicDialog({
  topicId,
  onClose,
}: {
  topicId: HelpTopicId;
  onClose: () => void;
}) {
  const topic = HELP_TOPICS[topicId];
  return (
    <div className="onboarding-backdrop" role="presentation" onClick={onClose}>
      <div
        className="onboarding-help-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="onboarding-wizard-header">
          <h2 id="help-dialog-title" className="onboarding-wizard-title" style={{ margin: 0 }}>
            {topic.title}
          </h2>
          <button type="button" className="btn btn-ghost btn-small" onClick={onClose} aria-label="Close">
            Close
          </button>
        </div>
        <ol className="onboarding-help-list">
          {topic.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {topic.hint && <p className="hint onboarding-help-hint">{topic.hint}</p>}
      </div>
    </div>
  );
}

export function HelpMenu({ onOpenWizard }: HelpMenuProps) {
  const [open, setOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState<HelpTopicId | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <>
      <div className="help-menu-wrap" ref={wrapRef}>
        <button
          type="button"
          className="help-menu-trigger"
          aria-expanded={open}
          aria-haspopup="menu"
          title="Help"
          onClick={() => setOpen((v) => !v)}
        >
          ?
        </button>
        {open && (
          <div className="help-menu-dropdown" role="menu">
            <button
              type="button"
              role="menuitem"
              className="help-menu-item"
              onClick={() => {
                setOpen(false);
                onOpenWizard();
              }}
            >
              Quick tour ({WIZARD_SLIDES.length} steps)
            </button>
            <button
              type="button"
              role="menuitem"
              className="help-menu-item"
              onClick={() => {
                setOpen(false);
                setHelpTopic("tool");
              }}
            >
              How to use this tool
            </button>
            <button
              type="button"
              role="menuitem"
              className="help-menu-item"
              onClick={() => {
                setOpen(false);
                setHelpTopic("project");
              }}
            >
              Project intelligence
            </button>
            <button
              type="button"
              role="menuitem"
              className="help-menu-item"
              onClick={() => {
                setOpen(false);
                setHelpTopic("failure");
              }}
            >
              AI Failure Analyzer
            </button>
            <button
              type="button"
              role="menuitem"
              className="help-menu-item"
              onClick={() => {
                setOpen(false);
                setHelpTopic("codeOutput");
              }}
            >
              Code output modes
            </button>
            <button
              type="button"
              role="menuitem"
              className="help-menu-item"
              onClick={() => {
                setOpen(false);
                setHelpTopic("aiMemory");
              }}
            >
              AI memory (team style)
            </button>
          </div>
        )}
      </div>
      {helpTopic && <HelpTopicDialog topicId={helpTopic} onClose={() => setHelpTopic(null)} />}
    </>
  );
}

/* ——— Example step templates ——— */

type StepTemplatePickerProps = {
  onApply: (template: StepTemplate) => void;
};

export function StepTemplatePicker({ onApply }: StepTemplatePickerProps) {
  return (
    <div className="step-templates">
      <span className="step-templates-label">Examples</span>
      {STEP_TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          className="btn btn-ghost btn-small step-template-btn"
          onClick={() => onApply(t)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ——— Empty state in code panel ——— */

type ScriptEmptyStateProps = {
  loading: boolean;
  stepCount: number;
  hasOutput: boolean;
  children: ReactNode;
};

export function ScriptPanelBody({ loading, stepCount, hasOutput, children }: ScriptEmptyStateProps) {
  const showEmpty = !loading && !hasOutput;

  if (showEmpty) {
    return (
      <div className="code-empty-state" aria-live="polite">
        <p className="code-empty-title">No script yet</p>
        <p className="code-empty-text">
          Add test steps on the left, then click <strong>Generate Katalon Groovy</strong>.
        </p>
        {stepCount === 0 ? (
          <p className="code-empty-hint">Tip: try an <strong>Examples</strong> template under the Manual tab.</p>
        ) : (
          <p className="code-empty-hint">
            You have <strong>{stepCount}</strong> step{stepCount === 1 ? "" : "s"} ready — generate when you are set.
          </p>
        )}
      </div>
    );
  }

  if (loading && !hasOutput) {
    return (
      <div className="code-empty-state code-empty-state--loading" aria-live="polite">
        <p className="code-empty-title">Generating…</p>
        <p className="code-empty-text">Your Groovy script will appear here.</p>
      </div>
    );
  }

  return <>{children}</>;
}
