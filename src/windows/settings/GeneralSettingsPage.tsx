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
import { useTrayIconVisible } from "./useTrayIconVisible";
import { QuitIslandRow } from "./QuitIslandRow";
import { SettingsGroup } from "../../components/settings/SettingsGroup";

type GeneralSectionProps = {
  locale: LocaleCode;
  settings: IslandSettings;
  onLocaleChange: (locale: LocaleCode) => void;
  onSettingsChange: (settings: IslandSettings) => void;
};

function StartupSection({ locale, onLocaleChange }: GeneralSectionProps) {
  const [launchAtStartup, updateLaunchAtStartup] = useLaunchAtStartup();
  const [trayIconVisible, updateTrayIconVisible] = useTrayIconVisible();

  return (
    <BehaviorSettingsSection
      launchAtStartup={launchAtStartup}
      trayIconVisible={trayIconVisible}
      locale={locale}
      onLaunchAtStartupChange={updateLaunchAtStartup}
      onTrayIconVisibleChange={updateTrayIconVisible}
      onLocaleChange={onLocaleChange}
    />
  );
}

function PositionSection({ settings, onSettingsChange }: GeneralSectionProps) {
  return (
    <PositionSettingsSection
      settings={settings}
      onSettingsChange={onSettingsChange}
      onResetPosition={requestIslandPositionReset}
    />
  );
}

function DataSection() {
  return <DataSettingsSection onMoved={moveTodoFolder} />;
}

function QuitSection() {
  return (
    <SettingsGroup>
      <QuitIslandRow />
    </SettingsGroup>
  );
}

export function GeneralSettingsPage(props: GeneralSectionProps) {
  return (
    <>
      <StartupSection {...props} />
      <PositionSection {...props} />
      <SystemPermissionsSection />
      <DataSection />
      <QuitSection />
    </>
  );
}
