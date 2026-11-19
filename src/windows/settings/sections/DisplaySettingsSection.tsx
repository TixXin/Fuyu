import { SettingsGroup } from "../../../components/settings/SettingsGroup";
import { SettingsSliderRow } from "../../../components/settings/SettingsSliderRow";
import { SettingsToggleRow } from "../../../components/settings/SettingsToggleRow";
import { useTranslation } from "../../../i18n";
import { isMacOS } from "../../../lib/platform";
import { DEFAULT_SETTINGS } from "../../../lib/settings/settingsDefaults";
import { MAX_NOTCH_WING_MAX, MIN_NOTCH_WING_MAX } from "../../../lib/settings/settingsLimits";
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
      {isMacOS && (
        <SettingsSliderRow
          title={t.settings.layout.notchWingMax}
          description={t.settings.layout.notchWingMaxHint}
          value={settings.notchWingMax}
          min={MIN_NOTCH_WING_MAX}
          max={MAX_NOTCH_WING_MAX}
          step={2}
          format={(value) => `${value} px`}
          defaultValue={DEFAULT_SETTINGS.notchWingMax}
          resetLabel={t.settings.layout.resetToDefault}
          onChange={(notchWingMax) => onSettingsChange({ ...settings, notchWingMax })}
        />
      )}
    </SettingsGroup>
  );
}
