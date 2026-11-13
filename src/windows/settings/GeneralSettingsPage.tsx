import type { LocaleCode } from "../../i18n";
import { BehaviorSettingsSection } from "../../features/appearance/BehaviorSettingsSection";
import { PositionSettingsSection } from "../../features/appearance/PositionSettingsSection";
import { DataSettingsSection } from "../../features/settings-backup/DataSettingsSection";
import { SystemPermissionsSection } from "../../features/system-permissions/SystemPermissionsSection";
import { loadSaveDirectory, saveSaveDirectory } from "../../features/todos/storage";
import { sameDirectory } from "../../features/todos/saveDirectory";

function moveTodoFolder(from: string, to: string) {
  const join = (home: string) => `${home.replace(/[\\/]+$/, "")}\\todo`;
  if (sameDirectory(loadSaveDirectory(), join(from))) saveSaveDirectory(join(to));
}
import type { IslandSettings } from "../../features/appearance/types";
import { requestIslandPositionReset } from "./storage";
import { useLaunchAtStartup } from "./useLaunchAtStartup";

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
        onLaunchAtStartupChange={updateLaunchAtStartup}
        onLocaleChange={onLocaleChange}
      />
      <PositionSettingsSection
        settings={settings}
        onSettingsChange={onSettingsChange}
        onResetPosition={requestIslandPositionReset}
      />
      <SystemPermissionsSection />
      <DataSettingsSection onMoved={moveTodoFolder} />
    </>
  );
}
