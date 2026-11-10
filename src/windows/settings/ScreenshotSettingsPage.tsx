import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import type { IslandSettings } from "../../features/appearance/types";
import { useTranslation } from "../../i18n";
import { ModuleSwitchSection } from "./ModuleSwitchSection";
import "./ScreenshotSettingsPage.css";

/** Screenshots (C41): the module switch and, while on, its shortcuts. Changing them comes later. */
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
        <SettingsGroup title={text.shortcutsTitle} footer={text.shortcutsHint}>
          <SettingsRow title={text.region} description={text.regionHint} control={keys("Ctrl+Shift+1")} />
          <SettingsRow title={text.fullscreen} description={text.fullscreenHint} control={keys("Ctrl+Shift+7")} />
        </SettingsGroup>
      )}
    </>
  );
}
