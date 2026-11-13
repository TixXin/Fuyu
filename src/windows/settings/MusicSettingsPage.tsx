import type { IslandSettings } from "../../features/appearance/types";
import { SettingsGroup } from "../../components/settings/SettingsGroup";
import { SettingsRow } from "../../components/settings/SettingsRow";
import { MusicSourceSettingsSection } from "../../features/media/MusicSourceSettingsSection";
import { MusicBarSettingsSection } from "../../features/media/MusicBarSettingsSection";
import { LyricsSettingsSection } from "../../features/media/lyrics/LyricsSettingsSection";
import { LyricsKaraokeSettingsSection } from "../../features/media/lyrics/LyricsKaraokeSettingsSection";
import { useTranslation } from "../../i18n";
import { FeatureHeader } from "./FeatureHeader";

export function MusicSettingsPage({
  tab,
  settings,
  onSettingsChange,
}: {
  tab: "music" | "musicLyrics" | "musicLyricsStyle";
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const text = useTranslation().settings.lyrics;
  const header = <FeatureHeader feature="music" checked={settings.musicEnabled} onChange={(musicEnabled) => onSettingsChange({ ...settings, musicEnabled })} />;
  if (!settings.musicEnabled) return header;
  if (tab === "musicLyrics") return <LyricsSettingsSection part="sources" settings={settings} onSettingsChange={onSettingsChange} />;
  if (tab === "musicLyricsStyle") {
    return settings.lyricsOnIsland ? (
      <LyricsKaraokeSettingsSection settings={settings} onSettingsChange={onSettingsChange} />
    ) : (
      <SettingsGroup title={text.karaoke.title}>
        <SettingsRow searchable={false} title={text.onIsland} description={text.styleNeedsIsland} />
      </SettingsGroup>
    );
  }
  return (
    <>
      {header}
      <MusicBarSettingsSection />
      <LyricsSettingsSection part="island" settings={settings} onSettingsChange={onSettingsChange} />
      <MusicSourceSettingsSection />
    </>
  );
}
