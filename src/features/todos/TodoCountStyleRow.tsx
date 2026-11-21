import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../i18n";
import type { IslandSettings } from "../../lib/settings/types";

export function TodoCountStyleRow({ settings, onSettingsChange }: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  return (
    <SettingsToggleRow
      title={t.settings.layout.showIdleTodoCount}
      checked={settings.showIdleTodoCount}
      onChange={(showIdleTodoCount) => onSettingsChange({ ...settings, showIdleTodoCount })}
    />
  );
}
