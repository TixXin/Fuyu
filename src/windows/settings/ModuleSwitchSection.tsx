import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";

export function ModuleSwitchSection({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const t = useTranslation();

  return (
    <SettingsGroup>
      <SettingsToggleRow title={label} description={t.settings.modules.hint} checked={checked} onChange={onChange} />
    </SettingsGroup>
  );
}
