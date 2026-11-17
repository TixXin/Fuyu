import { ExpandSettingsSection } from "./sections/ExpandSettingsSection";
import { GameModeSettingsSection } from "./sections/GameModeSettingsSection";
import { TuckSettingsSection } from "./sections/TuckSettingsSection";
import type { IslandSettings } from "../../lib/settings/types";
import { SystemAlertsGroup } from "./SystemAlertsGroup";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

type BehaviorSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPageKeys: () => void;
};

export type BehaviorTab = "behavior" | "behaviorTuck" | "behaviorQuiet" | "behaviorAlerts";

const sections = settingsSections<BehaviorSectionProps, BehaviorTab>();

sections.add({ id: "behavior.expand", category: "behavior", order: 10, component: ExpandSettingsSection });
sections.add({ id: "behaviorTuck.tuck", category: "behaviorTuck", order: 10, component: TuckSettingsSection });
sections.add({ id: "behaviorQuiet.game-mode", category: "behaviorQuiet", order: 10, component: GameModeSettingsSection });
sections.add({ id: "behaviorAlerts.system", category: "behaviorAlerts", order: 10, component: SystemAlertsGroup });

export function BehaviorSettingsPage({ tab, ...props }: BehaviorSectionProps & { tab: BehaviorTab }) {
  return <SlotView slot={sections} group={tab} props={props} />;
}
