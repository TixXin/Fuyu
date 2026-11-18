import { SelectControl, type SelectOption } from "../controls/SelectControl";
import "./SettingsSelect.css";

export function SettingsSelect<T extends string>({
  value,
  options,
  ariaLabel,
  disabled = false,
  onChange,
}: {
  value: T;
  options: readonly SelectOption<T>[];
  ariaLabel: string;
  disabled?: boolean;
  onChange: (value: T) => void;
}) {
  return (
    <div className="settings-select">
      <SelectControl value={value} options={options} ariaLabel={ariaLabel} disabled={disabled} onChange={onChange} />
    </div>
  );
}
