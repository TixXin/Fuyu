import "./SettingsChoice.css";

export type SettingsChoiceOption<T extends string> = { value: T; label: string };

export function SettingsChoice<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: T;
  options: readonly SettingsChoiceOption<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="settings-choice" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            className={active ? "settings-choice__option settings-choice__option--active" : "settings-choice__option"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
