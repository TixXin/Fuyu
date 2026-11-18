import "./SettingsSwitch.css";

export function SettingsSwitch({
  id,
  checked,
  disabled,
  ariaLabel,
  onChange,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <span className="settings-switch">
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label={ariaLabel}
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span className="settings-switch__track" aria-hidden="true" />
    </span>
  );
}
