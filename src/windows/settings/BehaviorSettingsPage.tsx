import { ExpandSettingsSection } from "./sections/ExpandSettingsSection";
import { GameModeSettingsSection } from "./sections/GameModeSettingsSection";
import { TuckSettingsSection } from "./sections/TuckSettingsSection";
import type { IslandSettings } from "../../lib/settings/types";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { SystemAlertsGroup } from "./SystemAlertsGroup";
import { SlotView } from "../../features/plugin-kernel/SlotView";
import { settingsSections } from "./slots/sectionSlot";

type BehaviorSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPageKeys: () => void;
};

function PageKeysSection({ onOpenPageKeys }: BehaviorSectionProps) {
  const text = useTranslation().settings.expand;
  return (
    <SettingsGroup>
      <SettingsRow
        searchable={false}
        title={text.pageKeys}
        description={text.pageKeysHint}
        control={<SettingsLinkButton onClick={onOpenPageKeys}>{text.pageKeysOpen}</SettingsLinkButton>}
      />
    </SettingsGroup>
  );
}

type BehaviorTab = "behavior" | "behaviorTuck" | "behaviorAlerts";

const sections = settingsSections<BehaviorSectionProps, BehaviorTab>();

sections.add({ id: "behavior.expand", category: "behavior", order: 10, component: ExpandSettingsSection });
sections.add({ id: "behavior.page-keys", category: "behavior", order: 20, component: PageKeysSection });
sections.add({ id: "behaviorTuck.tuck", category: "behaviorTuck", order: 10, component: TuckSettingsSection });
sections.add({ id: "behaviorTuck.game-mode", category: "behaviorTuck", order: 20, component: GameModeSettingsSection });
sections.add({ id: "behaviorAlerts.system", category: "behaviorAlerts", order: 10, component: SystemAlertsGroup });

export function BehaviorSettingsPage({ tab, ...props }: BehaviorSectionProps & { tab: BehaviorTab }) {
  return <SlotView slot={sections} group={tab} props={props} />;
}
