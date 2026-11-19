import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import type { IslandSettings } from "../../../lib/settings/types";

export function DisplaySettingsSection({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();

  return (
    <SettingsGroup title={t.settings.layout.displayTitle}>
      <SettingsToggleRow
        title={t.settings.layout.showCollapsedText}
        checked={settings.showCollapsedText}
        onChange={(showCollapsedText) => onSettingsChange({ ...settings, showCollapsedText })}
      />
      <SettingsToggleRow
        title={t.settings.layout.showTitle}
        checked={settings.showTitle}
        onChange={(showTitle) => onSettingsChange({ ...settings, showTitle })}
      />
      <SettingsToggleRow
        title={t.settings.layout.collapsedOverflowMore}
        description={t.settings.layout.collapsedOverflowMoreHint}
        checked={settings.collapsedOverflowMore}
        onChange={(collapsedOverflowMore) => onSettingsChange({ ...settings, collapsedOverflowMore })}
      />
    </SettingsGroup>
  );
}
