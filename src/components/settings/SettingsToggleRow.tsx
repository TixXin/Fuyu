import { useId, type ReactNode } from "react";
import { SettingsRow } from "./SettingsRow";
import { SettingsSwitch } from "./SettingsSwitch";

/** A row whose control is an on / off switch; clicking the title toggles it too. */
export function SettingsToggleRow({
  title,
  description,
  checked,
  indent,
  searchable,
  onChange,
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  indent?: boolean | 2 | 3;
  /** False for a row that is data, not a setting (see SettingsRow). */
  searchable?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <SettingsRow
      title={title}
      description={description}
      indent={indent}
      searchable={searchable}
      labelFor={id}
      control={<SettingsSwitch id={id} checked={checked} onChange={onChange} />}
    />
  );
}
