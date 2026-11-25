import { ArrowLeft, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import type { OnboardingSetupStepSpec, OnboardingStepSpec } from "./flow";

type MainHeaderProps = {
  mode: "main";
  steps: readonly OnboardingStepSpec[];
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

export function OnboardingHeader(props: MainHeaderProps | SetupHeaderProps) {
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
        <button className="onboarding__close" type="button" aria-label={text.close} onClick={props.onClose}>
          <X size={15} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </header>
    );
  }

  const current = props.steps[props.index];
  return (
    <header className="onboarding__bar">
      <div className="onboarding__stage">
        <div className="onboarding__progress" role="group" aria-label={text.stepOf(props.index + 1, props.steps.length)}>
          {props.steps.map((step, at) => {
            const label = text.stages[step.id];
            const clickable = at < props.index;
            return (
              <button
                key={step.id}
                type="button"
                className={
                  at === props.index
                    ? "onboarding__dot onboarding__dot--active"
                    : clickable
                      ? "onboarding__dot onboarding__dot--done"
                      : "onboarding__dot"
                }
                disabled={!clickable}
                aria-label={clickable ? text.stepJump(label) : label}
                aria-current={at === props.index ? "step" : undefined}
                title={clickable ? text.stepJump(label) : label}
                onClick={() => clickable && props.onJump(at)}
              />
            );
          })}
        </div>
        {current && (
          <span className="onboarding__stage-meta">
            <span>{text.stepCounter(props.index + 1, props.steps.length)}</span>
            <span className="onboarding__stage-sep" aria-hidden="true">·</span>
            <span>{text.stages[current.id]}</span>
          </span>
        )}
      </div>
      <button className="onboarding__close" type="button" aria-label={text.close} onClick={props.onClose}>
        <X size={15} strokeWidth={1.6} aria-hidden="true" />
      </button>
    </header>
  );
}
