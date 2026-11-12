import type { IslandSettings } from "../../features/appearance/types";
import type { MediaState } from "../../features/media/api";
import { useCurrentLyric, type CurrentLyric } from "../../features/media/lyrics/useCurrentLyric";
import { usePlayingLyrics, type PlayingLyrics } from "../../features/media/lyrics/usePlayingLyrics";
import { songLine } from "../../features/media/lyrics/songLine";
import { karaokeLook } from "../../features/media/lyrics/lyricsSettings";
import type { IslandPage } from "./types";

type IslandLyricsOptions = {
  page: IslandPage;
  barShown: boolean;
};

export function useIslandLyrics(settings: IslandSettings, mediaState: MediaState, { page, barShown }: IslandLyricsOptions): {
  lyrics: PlayingLyrics;
  lyricLine: CurrentLyric | null;
} {
  const onIsland = settings.musicEnabled && settings.lyricsOnIsland;
  const lyrics = usePlayingLyrics(mediaState, settings, onIsland || page === "music");
  const karaoke = settings.lyricsKaraoke ? { even: settings.lyricsKaraokeFallback === "line", look: karaokeLook(settings) } : null;
  const current = useCurrentLyric(lyrics.lines, mediaState, lyrics.offsetMs, onIsland && barShown, karaoke);
  if (current.text) return { lyrics, lyricLine: current };
  const song = onIsland && barShown && settings.lyricsIslandPriority === "lyrics" ? songLine(mediaState, lyrics.notFound) : null;
  return { lyrics, lyricLine: song };
}
