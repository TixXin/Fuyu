import { ExpandSettingsSection } from "./sections/ExpandSettingsSection";
import { GameModeSettingsSection } from "./sections/GameModeSettingsSection";
import { TuckSettingsSection } from "./sections/TuckSettingsSection";
import type { IslandSettings } from "../../lib/settings/types";
import { FeatureHeader } from "../../components/settings/FeatureHeader";
import { settingsCategoryIcon } from "../../features/plugin-kernel/settingsCategories";
import { SystemAlertsGroup } from "./SystemAlertsGroup";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

type BehaviorSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPageKeys: () => void;
};

export type BehaviorTab = "behavior" | "behaviorTuck" | "behaviorAlerts";

const sections = settingsSections<BehaviorSectionProps, BehaviorTab>();

sections.add({ id: "behavior.expand", category: "behavior", order: 10, component: ExpandSettingsSection });
sections.add({ id: "behavior.game-mode", category: "behavior", order: 20, component: GameModeSettingsSection });
sections.add({ id: "behaviorTuck.tuck", category: "behaviorTuck", order: 10, component: TuckSettingsSection });
sections.add({ id: "behaviorAlerts.system", category: "behaviorAlerts", order: 10, component: SystemAlertsGroup });

export function BehaviorSettingsPage({ tab, ...props }: BehaviorSectionProps & { tab: BehaviorTab }) {
  return (
    <>
      {tab === "behaviorAlerts" && <FeatureHeader feature="behaviorAlerts" icon={settingsCategoryIcon("behaviorAlerts")} />}
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}
