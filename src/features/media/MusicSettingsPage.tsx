import type { IslandSettings } from "../../lib/settings/types";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { MusicSourceSettingsSection } from "./MusicSourceSettingsSection";
import { MusicBarSettingsSection } from "./MusicBarSettingsSection";
import { LyricsSettingsSection } from "./lyrics/LyricsSettingsSection";
import { LyricsKaraokeSettingsSection } from "./lyrics/LyricsKaraokeSettingsSection";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "../../components/settings/FeatureHeader";
import { SlotView } from "../plugin-kernel/SlotView";
import { settingsSections } from "../plugin-kernel/settingsSlots";
import { settingsCategoryIcon } from "../plugin-kernel/settingsCategories";

type MusicSectionProps = {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
};

function IslandLyricsSection({ settings, onSettingsChange }: MusicSectionProps) {
  return <LyricsSettingsSection part="island" settings={settings} onSettingsChange={onSettingsChange} />;
}

function TuckSection({ settings, onSettingsChange }: MusicSectionProps) {
  const t = useTranslation().settings;
  return (
    <SettingsGroup title={t.expand.tuckTitle}>
      <SettingsToggleRow
        title={t.expand.holdMusic}
        description={t.expand.holdMusicElsewhere}
        checked={settings.autoTuckHoldMusic}
        onChange={(autoTuckHoldMusic) => onSettingsChange({ ...settings, autoTuckHoldMusic })}
      />
    </SettingsGroup>
  );
}

function LyricsSourcesSection({ settings, onSettingsChange }: MusicSectionProps) {
  return <LyricsSettingsSection part="sources" settings={settings} onSettingsChange={onSettingsChange} />;
}

function KaraokeSection({ settings, onSettingsChange }: MusicSectionProps) {
  const text = useTranslation().settings.lyrics;
  return settings.lyricsOnIsland ? (
    <LyricsKaraokeSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
  ) : (
    <SettingsGroup title={text.karaoke.title}>
      <SettingsToggleRow
        searchable={false}
        title={text.onIsland}
        description={text.styleNeedsIsland}
        checked={false}
        onChange={(lyricsOnIsland) => onSettingsChange({ ...settings, lyricsOnIsland })}
      />
    </SettingsGroup>
  );
}

type MusicTab = "music" | "musicLyrics" | "musicLyricsStyle";

const sections = settingsSections<MusicSectionProps, MusicTab>();

sections.add({ id: "music.bar", category: "music", order: 10, component: MusicBarSettingsSection });
sections.add({ id: "music.lyrics", category: "music", order: 20, component: IslandLyricsSection });
sections.add({ id: "music.sources", category: "music", order: 30, component: MusicSourceSettingsSection });
sections.add({ id: "music.tuck", category: "music", order: 40, component: TuckSection });
sections.add({ id: "musicLyrics.sources", category: "musicLyrics", order: 10, component: LyricsSourcesSection });
sections.add({ id: "musicLyricsStyle.karaoke", category: "musicLyricsStyle", order: 10, component: KaraokeSection });

export function MusicSettingsPage({ tab, ...props }: MusicSectionProps & { tab: MusicTab }) {
  return (
    <>
      <FeatureHeader feature="music" icon={settingsCategoryIcon("music")} />
      <SlotView slot={sections} group={tab} props={props} />
    </>
  );
}
