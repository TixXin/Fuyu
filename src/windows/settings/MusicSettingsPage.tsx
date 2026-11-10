import type { IslandSettings } from "../../features/appearance/types";
import { MusicSourceSettingsSection } from "../../features/media/MusicSourceSettingsSection";
import { MusicBarSettingsSection } from "../../features/media/MusicBarSettingsSection";
import { LyricsSettingsSection } from "../../features/media/lyrics/LyricsSettingsSection";
import { LyricsKaraokeSettingsSection } from "../../features/media/lyrics/LyricsKaraokeSettingsSection";
import { useTranslation } from "../../i18n";
import { ModuleSwitchSection } from "./ModuleSwitchSection";

export function MusicSettingsPage({
  settings,
  onSettingsChange,
}: {
  settings: IslandSettings;
  onSettingsChange: (settings: IslandSettings) => void;
}) {
  const t = useTranslation();

  return (
    <>
      <ModuleSwitchSection
        label={t.settings.modules.music}
        checked={settings.musicEnabled}
        onChange={(musicEnabled) => onSettingsChange({ ...settings, musicEnabled })}
      />
      {settings.musicEnabled && <MusicBarSettingsSection />}
      {settings.musicEnabled && <MusicSourceSettingsSection />}
      {settings.musicEnabled && <LyricsSettingsSection settings={settings} onSettingsChange={onSettingsChange} />}
      {settings.musicEnabled && settings.lyricsOnIsland && <LyricsKaraokeSettingsSection settings={settings} onSettingsChange={onSettingsChange} />}
    </>
  );
}
