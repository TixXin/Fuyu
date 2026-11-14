import { Check } from "lucide-react";
import type { SettingsChoiceOption } from "./SettingsChoice";
import "./SettingsChoice.css";

export function SettingsMultiChoice<T extends string>({
  values,
  options,
  ariaLabel,
  onToggle,
}: {
  values: readonly T[];
  options: readonly SettingsChoiceOption<T>[];
  ariaLabel: string;
  onToggle: (value: T, selected: boolean) => void;
}) {
  return (
    <div className="settings-choice settings-choice--multi" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = values.includes(option.value);
        return (
          <button
            key={option.value}
            className={active ? "settings-choice__option settings-choice__option--active" : "settings-choice__option"}
            type="button"
            aria-pressed={active}
            onClick={() => onToggle(option.value, !active)}
          >
            {active ? <Check size={13} strokeWidth={2.4} aria-hidden="true" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
