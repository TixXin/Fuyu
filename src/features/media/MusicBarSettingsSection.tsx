import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { arrangeCollapsedItems, isCollapsedItemHidden, setCollapsedItemHidden } from "../../lib/settings/collapsedItems";
import { useCollapsedPlacements } from "../../lib/settings/useCollapsedPlacements";
import { useTranslation } from "../../i18n";

const MUSIC_ITEM = "music";

export function MusicBarSettingsSection() {
  const text = useTranslation().settings.musicBar;
  const { placements, save } = useCollapsedPlacements();
  const shown = !isCollapsedItemHidden(placements, MUSIC_ITEM);

  return (
    <SettingsGroup title={text.title}>
      <SettingsToggleRow
        title={text.wave}
        description={text.waveHint}
        checked={shown}
        onChange={(show) => save(setCollapsedItemHidden(arrangeCollapsedItems([MUSIC_ITEM], placements), MUSIC_ITEM, !show))}
      />
    </SettingsGroup>
  );
}
