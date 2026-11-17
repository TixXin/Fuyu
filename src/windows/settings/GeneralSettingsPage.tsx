import type { LocaleCode } from "../../i18n";
import { BehaviorSettingsSection } from "./sections/BehaviorSettingsSection";
import { DataSettingsSection } from "./sections/DataSettingsSection";
import { SystemPermissionsSection } from "./sections/SystemPermissionsSection";
import { loadSaveDirectory, saveSaveDirectory } from "../../features/todos/storage";
import { sameDirectory } from "../../features/todos/saveDirectory";
import type { IslandSettings } from "../../lib/settings/types";
import { useLaunchAtStartup } from "./useLaunchAtStartup";
import { useTrayIconVisible } from "./useTrayIconVisible";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

function moveTodoFolder(from: string, to: string) {
  const join = (home: string) => `${home.replace(/[\\/]+$/, "")}\\todo`;
  if (sameDirectory(loadSaveDirectory(), join(from))) saveSaveDirectory(join(to));
}

export type GeneralTab = "general" | "generalData";

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

function DataSection() {
  return <DataSettingsSection onMoved={moveTodoFolder} />;
}

const sections = settingsSections<GeneralSectionProps, GeneralTab>();

sections.add({ id: "general.startup", category: "general", order: 10, component: StartupSection });
sections.add({ id: "general.permissions", category: "general", order: 30, component: SystemPermissionsSection });
sections.add({ id: "generalData.data", category: "generalData", order: 10, component: DataSection });

export function GeneralSettingsPage({ tab, ...props }: GeneralSectionProps & { tab: GeneralTab }) {
  return <SlotView slot={sections} group={tab} props={props} />;
}
