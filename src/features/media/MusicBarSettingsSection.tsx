import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { IslandPlacementRow } from "../plugin-kernel/IslandPlacementRow";
import { useTranslation } from "../../i18n";

export function MusicBarSettingsSection() {
  const text = useTranslation().settings.musicBar;

  return (
    <SettingsGroup title={text.title}>
      <IslandPlacementRow item="music" title={text.wave} />
    </SettingsGroup>
  );
}
