import { ArrowLeft, Check, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { OnboardingSetupStepSpec, OnboardingStepSpec, OnboardingWhatsNewStepSpec } from "./flow";

type MainHeaderProps = {
  mode: "firstRun";
  steps: readonly OnboardingStepSpec[];
  index: number;
  onJump: (index: number) => void;
  onClose: () => void;
};

type WhatsNewHeaderProps = {
  mode: "whatsNew";
  steps: readonly OnboardingWhatsNewStepSpec[];
  index: number;
  onJump: (index: number) => void;
  onClose: () => void;
};

type SetupHeaderProps = {
  mode: "setup";
  steps: readonly OnboardingSetupStepSpec[];
  index: number;
  onJump: (index: number) => void;
  onBackToSummary: () => void;
  onClose: () => void;
};

export function OnboardingHeader(props: MainHeaderProps | WhatsNewHeaderProps | SetupHeaderProps) {
  const text = useTranslation().onboarding;

  if (props.mode === "setup") {
    return (
      <header className="onboarding__bar onboarding__bar--setup">
        <button className="onboarding__back-link" type="button" onClick={props.onBackToSummary}>
          <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
          {text.backToSummary}
        </button>
        <nav className="onboarding__setup-tabs" aria-label={text.stepOf(props.index + 1, props.steps.length)}>
          {props.steps.map((step, at) => (
            <button
              key={step.id}
              type="button"
              className={
                at === props.index
                  ? "onboarding__setup-tab onboarding__setup-tab--active"
                  : at < props.index
                    ? "onboarding__setup-tab onboarding__setup-tab--done"
                    : "onboarding__setup-tab"
              }
              aria-current={at === props.index ? "step" : undefined}
              onClick={() => props.onJump(at)}
            >
              {text.setupStages[step.id]}
            </button>
          ))}
        </nav>
        <div className="onboarding__bar-right">
          <span className="onboarding__track-pill">{text.trackLabels.setup}</span>
          <button className="onboarding__close" type="button" aria-label={text.close} onClick={props.onClose}>
            <X size={15} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>
      </header>
    );
  }

  const items = props.mode === "whatsNew"
    ? props.steps.map((step) => ({ id: step.id, label: text.whatsNewStages[step.id] }))
    : props.steps.map((step) => ({ id: step.id, label: text.stages[step.id] }));

  return (
    <header className="onboarding__bar">
      <div className="onboarding__stage">
        <div className="onboarding__progress" role="group" aria-label={text.stepOf(props.index + 1, items.length)}>
          {items.map(({ id, label }, at) => {
            const done = at < props.index;
            const active = at === props.index;
            return (
              <button
                key={id}
                type="button"
                className={
                  active
                    ? "onboarding__dot onboarding__dot--active"
                    : done
                      ? "onboarding__dot onboarding__dot--done"
                      : "onboarding__dot"
                }
                disabled={!done}
                aria-label={done ? text.stepJump(label) : label}
                aria-current={active ? "step" : undefined}
                title={done ? text.stepJump(label) : label}
                onClick={() => done && props.onJump(at)}
              >
                <span className="onboarding__dot-num" aria-hidden="true">
                  {done ? <Check size={10} strokeWidth={2.4} /> : at + 1}
                </span>
                <span className="onboarding__dot-label">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="onboarding__bar-right">
        <span className="onboarding__track-pill">{text.trackLabels[props.mode]}</span>
        <button className="onboarding__close" type="button" aria-label={text.close} onClick={props.onClose}>
          <X size={15} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
