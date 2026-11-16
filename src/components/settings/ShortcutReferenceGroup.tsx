import type { ReactNode } from "react";
import { SettingsGroup } from "./SettingsGroup";
import { SettingsRow } from "./SettingsRow";
import { ShortcutKeys } from "../../components/controls/ShortcutKeys";

export function ShortcutReferenceGroup({ title, rows, footer, action }: { title: string; rows: [string, string][]; footer?: string; action?: ReactNode }) {
  return (
    <SettingsGroup title={title} footer={footer} action={action}>
      {rows.map(([label, keys]) => (
        <SettingsRow key={label} title={label} control={<ShortcutKeys label={keys} />} />
      ))}
    </SettingsGroup>
  );
}
