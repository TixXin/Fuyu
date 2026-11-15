import { ExpandSettingsSection } from "../../features/appearance/ExpandSettingsSection";
import { GameModeSettingsSection } from "../../features/appearance/GameModeSettingsSection";
import { TuckSettingsSection } from "../../features/appearance/TuckSettingsSection";
import { BreakRemindersGroup } from "../../features/timer/BreakRemindersGroup";
import type { IslandSettings } from "../../features/appearance/types";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { SystemAlertsGroup } from "./SystemAlertsGroup";

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

export function BehaviorSettingsPage({
  tab,
  ...props
}: BehaviorSectionProps & {
  tab: "behavior" | "behaviorTuck" | "behaviorAlerts";
}) {
  const { settings, onSettingsChange } = props;
  if (tab === "behaviorAlerts") {
    return (
      <>
        <SystemAlertsGroup settings={settings} onSettingsChange={onSettingsChange} />
        <BreakRemindersGroup />
      </>
    );
  }
  if (tab === "behaviorTuck") {
    return (
      <>
        <TuckSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
        <GameModeSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      </>
    );
  }
  return (
    <>
      <ExpandSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
      <PageKeysSection {...props} />
    </>
  );
}
