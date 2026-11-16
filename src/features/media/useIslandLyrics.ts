import type { IslandSettings } from "../../lib/settings/types";
import type { MediaState } from "./api";
import { useCurrentLyric, type CurrentLyric } from "./lyrics/useCurrentLyric";
import { usePlayingLyrics, type PlayingLyrics } from "./lyrics/usePlayingLyrics";
import { introLine, songLine } from "./lyrics/songLine";
import { karaokeLook } from "./lyrics/lyricsSettings";

type IslandLyricsOptions = {
  page: string;
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
  if (current.intro) return { lyrics, lyricLine: introLine(mediaState, settings.lyricsIntro, current.longest) ?? { ...current, text: null } };
  const song = onIsland && barShown && settings.lyricsIslandPriority === "lyrics" ? songLine(mediaState, lyrics.notFound) : null;
  return { lyrics, lyricLine: song };
}
