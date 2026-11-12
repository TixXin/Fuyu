import "./SettingsColor.css";

export function SettingsColor({
  value,
  ariaLabel,
  onChange,
}: {
  value: string;
  ariaLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-color">
      <span className="settings-color__value">{value.toUpperCase()}</span>
      <input
        className="settings-color__swatch"
        type="color"
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}
