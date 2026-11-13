import { ExpandSettingsSection } from "../../features/appearance/ExpandSettingsSection";
import { GameModeSettingsSection } from "../../features/appearance/GameModeSettingsSection";
import { TuckSettingsSection } from "../../features/appearance/TuckSettingsSection";
import type { IslandSettings } from "../../features/appearance/types";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsLinkButton } from "../../components/settings/SettingsLinkButton";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { useTranslation } from "../../i18n";
import { SystemAlertsGroup } from "./SystemAlertsGroup";

export function BehaviorSettingsPage({
  tab,
  settings,
  onSettingsChange,
  onOpenPageKeys,
}: {
  tab: "behavior" | "behaviorTuck" | "behaviorAlerts";
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
  onOpenPageKeys: () => void;
}) {
  const text = useTranslation().settings.expand;
  if (tab === "behaviorAlerts") return <SystemAlertsGroup settings={settings} onSettingsChange={onSettingsChange} />;
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
      <SettingsGroup>
        <SettingsRow
          searchable={false}
          title={text.pageKeys}
          description={text.pageKeysHint}
          control={<SettingsLinkButton onClick={onOpenPageKeys}>{text.pageKeysOpen}</SettingsLinkButton>}
        />
      </SettingsGroup>
    </>
  );
}
