import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import type { IslandSettings } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { ModuleSwitchSection } from "./ModuleSwitchSection";
import "./ScreenshotSettingsPage.css";

export function ScreenshotSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();
  const text = t.settings.screenshot;
  const keys = (label: string) => <kbd className="screenshot-settings__keys">{label}</kbd>;

  return (
    <>
      <ModuleSwitchSection
        label={t.settings.modules.screenshot}
        checked={settings.screenshotEnabled}
        onChange={(screenshotEnabled) => onSettingsChange({ ...settings, screenshotEnabled })}
      />
      {settings.screenshotEnabled && (
        <SettingsGroup title={text.whileCapturingTitle}>
          <SettingsToggleRow
            title={text.guides}
            description={text.guidesHint}
            checked={settings.screenshotGuides}
            onChange={(screenshotGuides) => onSettingsChange({ ...settings, screenshotGuides })}
          />
        </SettingsGroup>
      )}
      {settings.screenshotEnabled && (
        <SettingsGroup title={text.shortcutsTitle} footer={text.shortcutsHint}>
          <SettingsRow title={text.region} description={text.regionHint} control={keys("Ctrl+Shift+1")} />
          <SettingsRow title={text.copy} description={text.copyHint} control={keys("Ctrl+Shift+2")} />
          <SettingsRow title={text.text} description={text.textHint} control={keys("Ctrl+Shift+3")} />
          <SettingsRow title={text.translate} description={text.translateHint} control={keys("Ctrl+Shift+4")} />
          <SettingsRow title={text.fullscreen} description={text.fullscreenHint} control={keys("Ctrl+Shift+7")} />
        </SettingsGroup>
      )}
    </>
  );
}
