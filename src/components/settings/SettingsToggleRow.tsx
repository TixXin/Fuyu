import { useId, type ReactNode } from "react";
import { SettingsRow } from "./SettingsRow";
import { SettingsSwitch } from "./SettingsSwitch";

export function SettingsToggleRow({
  title,
  description,
  checked,
  disabled,
  indent,
  searchable,
  since,
  onChange,
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  indent?: boolean | 2 | 3;
  searchable?: boolean;
  since?: string;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <SettingsRow
      title={title}
      description={description}
      indent={indent}
      searchable={searchable}
      since={since}
      labelFor={id}
      control={<SettingsSwitch id={id} checked={checked} disabled={disabled} onChange={onChange} />}
    />
  );
}
