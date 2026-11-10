import type { LocaleCode } from "../../i18n";
import { BehaviorSettingsSection } from "../../features/appearance/BehaviorSettingsSection";
import { PositionSettingsSection } from "../../features/appearance/PositionSettingsSection";
import { SettingsBackupSection } from "../../features/settings-backup/SettingsBackupSection";
import type { IslandSettings } from "../../features/appearance/types";
import { requestIslandPositionReset } from "./storage";
import { useLaunchAtStartup } from "./useLaunchAtStartup";

/** Settings → General: app-wide settings (start-up, language, minimising), where the island sits, and backup. How it reacts is on Behavior. */
export function GeneralSettingsPage({
  locale,
  settings,
  onLocaleChange,
  onSettingsChange,
}: {
  locale: LocaleCode;
  settings: IslandSettings;
  onLocaleChange: (locale: LocaleCode) => void;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const [launchAtStartup, updateLaunchAtStartup] = useLaunchAtStartup();

  return (
    <>
      <BehaviorSettingsSection
        launchAtStartup={launchAtStartup}
        locale={locale}
        settings={settings}
        onLaunchAtStartupChange={updateLaunchAtStartup}
        onLocaleChange={onLocaleChange}
        onSettingsChange={onSettingsChange}
      />
      <PositionSettingsSection
        settings={settings}
        onSettingsChange={onSettingsChange}
        onResetPosition={requestIslandPositionReset}
      />
      <SettingsBackupSection />
    </>
  );
}
