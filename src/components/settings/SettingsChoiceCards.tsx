import type { ReactNode } from "react";
import { Check } from "lucide-react";
import "./SettingsChoiceCards.css";

export type SettingsChoiceCard<T extends string> = { value: T; label: string; hint?: string; art: ReactNode };

export function SettingsChoiceCards<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: T;
  options: readonly SettingsChoiceCard<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="settings-cards" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            className={active ? "settings-cards__card settings-cards__card--active" : "settings-cards__card"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            <span className="settings-cards__art" aria-hidden="true">{option.art}</span>
            <span className="settings-cards__text">
              <span className="settings-cards__label">{option.label}</span>
              {option.hint ? <span className="settings-cards__hint">{option.hint}</span> : null}
            </span>
            {active ? <Check className="settings-cards__check" size={14} strokeWidth={2.6} aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
