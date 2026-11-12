import { SelectControl, type SelectOption } from "../controls/SelectControl";
import "./SettingsSelect.css";

export function SettingsSelect<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
}: {
  value: T;
  options: readonly SelectOption<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="settings-select">
      <SelectControl value={value} options={options} ariaLabel={ariaLabel} onChange={onChange} />
    </div>
  );
}
