import type { IslandSettings } from "../../features/appearance/types";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { SettingsToggleRow } from "../../components/settings/SettingsToggleRow";
import { MusicSourceSettingsSection } from "../../features/media/MusicSourceSettingsSection";
import { MusicBarSettingsSection } from "../../features/media/MusicBarSettingsSection";
import { LyricsSettingsSection } from "../../features/media/lyrics/LyricsSettingsSection";
import { LyricsKaraokeSettingsSection } from "../../features/media/lyrics/LyricsKaraokeSettingsSection";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "./FeatureHeader";

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
      <SettingsRow searchable={false} title={text.onIsland} description={text.styleNeedsIsland} />
    </SettingsGroup>
  );
}

export function MusicSettingsPage({
  tab,
  ...props
}: MusicSectionProps & {
  tab: "music" | "musicLyrics" | "musicLyricsStyle";
}) {
  if (tab === "musicLyrics") return <LyricsSourcesSection {...props} />;
  if (tab === "musicLyricsStyle") return <KaraokeSection {...props} />;
  return (
    <>
      <FeatureHeader feature="music" />
      <MusicBarSettingsSection />
      <IslandLyricsSection {...props} />
      <MusicSourceSettingsSection />
      <TuckSection {...props} />
    </>
  );
}
